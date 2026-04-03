"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { EventState } from "@/lib/types";
import {
  watchEventState,
  setTemperature,
  watchViewers,
  tryJoinViewer,
  leaveViewer,
  incrementTapScore,
  watchTapScores,
  type ViewerInfo,
} from "@/lib/event-store";
import {
  getAudioContext,
  resumeAudio,
  playFanfare,
  playTudum,
} from "@/lib/sounds";
import { ViewerReceiver } from "@/lib/webrtc";
import TemperatureGauge from "@/components/TemperatureGauge";
import GameAlert from "@/components/GameAlert";

type Phase =
  | "GATE"
  | "LOBBY"
  | "WAITING"
  | "PLAYING"
  | "CELEBRATION"
  | "RANKING"
  | "BLACKOUT"
  | "REVEAL"
  | "ABORTED";

async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  const end = Date.now() + 3000;
  const shoot = () => {
    confetti({
      particleCount: 60,
      spread: 80,
      origin: { x: Math.random(), y: Math.random() * 0.4 },
      colors: ["#ff0044", "#ff6b35", "#ffd700", "#00e5ff", "#b347ff"],
    });
    if (Date.now() < end) requestAnimationFrame(shoot);
  };
  shoot();
}

export default function ViewerPage() {
  const [phase, setPhase] = useState<Phase>("GATE");
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [viewers, setViewers] = useState<Record<string, ViewerInfo>>({});
  const [eventState, setEventState] = useState<EventState>({
    status: "WAITING",
    temperature: 0,
  });
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [tapFlash, setTapFlash] = useState(false);
  const [showHint, setShowHint] = useState(false);
  /** Firebase 이벤트 첫 수신 전 — 별명 화면 깜빡임 방지 */
  const [eventHydrated, setEventHydrated] = useState(false);
  /** 대기 중 인원 이탈 시 커스텀 알럿 */
  const [waitingBreakAlert, setWaitingBreakAlert] = useState<{
    title: string;
    lines: string[];
  } | null>(null);
  const [tapScores, setTapScores] = useState<Record<string, number>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const receiverRef = useRef<ViewerReceiver | null>(null);
  const phaseRef = useRef<Phase>("GATE");
  const tempRef = useRef(0);
  const tapCooldown = useRef(false);
  const sessionId = useRef(crypto.randomUUID());
  const myNickname = useRef("");
  const eventStatusRef = useRef<EventState["status"]>("WAITING");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    tempRef.current = eventState.temperature ?? 0;
  }, [eventState.temperature]);

  useEffect(() => {
    if (videoRef.current && hostStream) {
      videoRef.current.srcObject = hostStream;
      videoRef.current.volume = 1;
    }
  }, [hostStream]);

  // 참가자 목록 구독 + 3명 차면 LOBBY → WAITING + 리셋/이탈 감지
  const prevViewersRef = useRef<Record<string, ViewerInfo>>({});
  useEffect(() => {
    const unsub = watchViewers((v) => {
      const prev = prevViewersRef.current;
      prevViewersRef.current = v;
      setViewers(v);

      // 3명 모이면 WAITING으로
      if (phase === "LOBBY" && Object.keys(v).length >= 3) {
        setPhase("WAITING");
        return;
      }

      // 호스트 게임 시작 대기(WAITING) 중 한 명이라도 이탈 → 알럿 후 별명 화면
      if (
        phaseRef.current === "WAITING" &&
        eventStatusRef.current === "WAITING"
      ) {
        const prevCount = Object.keys(prev).length;
        const curCount = Object.keys(v).length;
        if (prevCount >= 3 && curCount < 3) {
          setWaitingBreakAlert(
            (prev) =>
              prev ?? {
                title: "인원이 달라졌어요",
                lines: [
                  "친구가 나갔어요.",
                  "다시 3명이 모이면 시작할 수 있어요.",
                ],
              },
          );
          return;
        }
      }

      // 내 세션이 사라졌다 = 호스트 리셋(뷰어 목록 초기화) 등 → GATE로 복귀
      // ABORTED 중에는 Firebase가 WAITING으로 바뀔 때까지 화면 유지 (handleStatusChange에서 GATE 처리)
      const iJoined =
        phaseRef.current !== "GATE" &&
        phaseRef.current !== "ABORTED" &&
        myNickname.current !== "";
      if (
        iJoined &&
        !v[sessionId.current] &&
        eventStatusRef.current === "WAITING"
      ) {
        myNickname.current = "";
        setPhase("GATE");
        return;
      }
    });
    return () => unsub();
  }, [phase]);

  const handleStatusChange = useCallback((newStatus: string) => {
    const cur = phaseRef.current;
    // ABORTED: GATE·LOBBY 포함 항상 반영 (새로고침·신규 입장자도 동일 화면)
    if (newStatus === "ABORTED" && cur !== "ABORTED") {
      setPhase("ABORTED");
      return;
    }
    // 호스트 리셋·초기화 → WAITING + 뷰어 목록 초기화에 맞춰 입장 화면으로
    if (
      newStatus === "WAITING" &&
      cur !== "WAITING" &&
      cur !== "GATE" &&
      cur !== "LOBBY"
    ) {
      myNickname.current = "";
      setPhase("GATE");
      return;
    }
    // GATE·LOBBY 는 그 외 Firebase 상태 무시 — 3명이 모여 WAITING이 된 뒤에만 반응
    if (cur === "GATE" || cur === "LOBBY") return;

    // phaseRef 기반 중복 방지 (이미 해당 phase면 무시)
    if (newStatus === "WAITING" && cur !== "WAITING") setPhase("WAITING");
    if (newStatus === "PLAYING" && cur !== "PLAYING") {
      setPhase("PLAYING");
      setShowHint(true);
    }
    if (newStatus === "CELEBRATION" && cur !== "CELEBRATION") {
      setPhase("CELEBRATION");
      fireConfetti();
      playFanfare();
    }
    if (newStatus === "RANKING" && cur !== "RANKING") setPhase("RANKING");
    if (newStatus === "BLACKOUT" && cur !== "BLACKOUT") setPhase("BLACKOUT");
    if (newStatus === "REVEAL" && cur !== "REVEAL") {
      setPhase("REVEAL");
      setTimeout(() => playTudum(), 100);
    }
  }, []);

  useEffect(() => {
    const unsub = watchEventState((state) => {
      setEventHydrated(true);
      eventStatusRef.current = state.status;
      setEventState(state);
      handleStatusChange(state.status);
    });
    return () => unsub();
  }, [handleStatusChange]);

  useEffect(() => {
    const unsub = watchTapScores(setTapScores);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (phase !== "REVEAL") {
      setHostStream(null);
      receiverRef.current?.disconnect();
      receiverRef.current = null;
      return;
    }
    const receiver = new ViewerReceiver();
    receiverRef.current = receiver;
    receiver.connect((stream) => setHostStream(stream));
    return () => {
      receiver.disconnect();
      receiverRef.current = null;
    };
  }, [phase]);

  const handleWaitingBreakConfirm = useCallback(() => {
    setWaitingBreakAlert(null);
    void leaveViewer(sessionId.current);
    myNickname.current = "";
    setNickname("");
    setPhase("GATE");
  }, []);

  // 페이지 떠날 때 참가자 제거
  useEffect(() => {
    return () => {
      leaveViewer(sessionId.current);
    };
  }, []);

  const handleEnter = async () => {
    const name = nickname.trim();
    if (!name) {
      setJoinError("별명을 입력해주세요");
      return;
    }
    const taken = Object.entries(viewers).some(
      ([sid, v]) =>
        sid !== sessionId.current &&
        v.nickname.trim().toLowerCase() === name.toLowerCase(),
    );
    if (taken) {
      setJoinError("이미 사용 중인 별명이에요");
      return;
    }
    setJoining(true);
    setJoinError("");

    await resumeAudio();
    getAudioContext();

    const joinResult = await tryJoinViewer(sessionId.current, name);
    if (joinResult === "full") {
      setJoinError("이미 3명이 입장했습니다 😢");
      setJoining(false);
      return;
    }
    if (joinResult === "duplicate") {
      setJoinError("이미 사용 중인 별명이에요");
      setJoining(false);
      return;
    }
    myNickname.current = name;
    setPhase("LOBBY");
    setJoining(false);
  };

  const handleTap = async () => {
    if (tapCooldown.current) return;
    tapCooldown.current = true;
    setTimeout(() => {
      tapCooldown.current = false;
    }, 300);
    setShowHint(false); // 첫 탭에 즉시 숨김
    const count = Math.max(1, Object.keys(viewers).length);
    // 3명×각 300탭(총 900탭) ≈ 100° 목표: 100 / (300 × 인원)
    const TAP_GOAL_PER_PERSON = 300;
    const gain = 100 / (TAP_GOAL_PER_PERSON * count);
    const next = Math.min(100, (tempRef.current ?? 0) + gain);
    await Promise.all([
      setTemperature(next),
      incrementTapScore(sessionId.current),
    ]);
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 150);
  };

  const viewerEntries = Object.entries(viewers); // [sessionId, ViewerInfo][]
  const viewerList = viewerEntries.map(([, info]) => info);
  const viewerCount = viewerEntries.length;

  // Firebase 첫 동기화 전: 게임 배경만 (별명 입력 UI 깜빡임 방지)
  if (!eventHydrated) {
    return (
      <div
        className="w-full h-full bg-[#0a0a0a] flex items-center justify-center"
        aria-busy="true"
        aria-label="연결 중"
      />
    );
  }

  // ─── GATE ─────────────────────────────────────────────────────────────────
  if (phase === "GATE") {
    const nicknameTaken =
      nickname.trim().length > 0 &&
      viewerEntries.some(
        ([sid, v]) =>
          sid !== sessionId.current &&
          v.nickname.trim().toLowerCase() === nickname.trim().toLowerCase(),
      );
    return (
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-8 px-8">
        <div className="text-center">
          <p className="text-6xl mb-3">🌡️</p>
          <h1 className="text-3xl font-black text-white tracking-tight">
            우정의 온도
          </h1>
          <p className="text-white/40 mt-2 text-sm">The Dramatic Reveal</p>
        </div>

        {/* 현재 입장 인원 */}
        <div className="flex gap-2 items-center">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
              style={{
                background: i < viewerCount ? "#f9731633" : "#ffffff11",
                borderColor: i < viewerCount ? "#f97316" : "#ffffff22",
                color: i < viewerCount ? "#f97316" : "#ffffff33",
              }}
            >
              {i < viewerCount ? viewerList[i].nickname[0] : "?"}
            </div>
          ))}
          <span className="text-white/40 text-sm ml-1">
            {viewerCount}/3명 입장
          </span>
        </div>

        {/* 별명 입력 */}
        <div className="w-full flex flex-col gap-3">
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setJoinError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEnter();
            }}
            placeholder="별명을 입력하세요"
            maxLength={8}
            className="w-full px-5 py-4 rounded-2xl text-white text-lg text-center font-bold
                       outline-none placeholder:text-white/30"
            style={{ background: "#ffffff11", border: "2px solid #ffffff22" }}
            autoFocus
          />
          {nicknameTaken && (
            <p className="text-amber-400/90 text-sm text-center">
              이미 입장한 별명이에요
            </p>
          )}
          {joinError && (
            <p className="text-red-400 text-sm text-center">{joinError}</p>
          )}
          <button
            onClick={handleEnter}
            disabled={joining || viewerCount >= 3 || nicknameTaken}
            className="w-full py-4 rounded-2xl text-lg font-bold text-white
                       disabled:opacity-40 active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #f97316, #ef4444)",
              boxShadow: "0 0 30px rgba(249,115,22,0.4)",
            }}
          >
            {joining
              ? "입장 중..."
              : viewerCount >= 3
                ? "입장 마감"
                : "입장하기 🔥"}
          </button>
        </div>
        <p className="text-white/20 text-xs">소리를 켜고 입장하세요</p>
      </div>
    );
  }

  // ─── LOBBY (입장 완료, 대기 중) ───────────────────────────────────────────
  if (phase === "LOBBY") {
    return (
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-8 px-8">
        <div className="text-center">
          <p className="text-6xl mb-3">🌡️</p>
          <h1 className="text-3xl font-black text-white tracking-tight">
            우정의 온도
          </h1>
          <p className="text-white/40 mt-2 text-sm">The Dramatic Reveal</p>
        </div>

        {/* 참가자 슬롯 */}
        <div className="flex gap-3 items-center">
          {[0, 1, 2].map((i) => {
            const v = viewerList[i];
            const isMe = v?.nickname === myNickname.current;
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 transition-all duration-300"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black border-2 transition-all duration-300"
                  style={{
                    background: v
                      ? isMe
                        ? "#f9731633"
                        : "#ffffff15"
                      : "#ffffff08",
                    borderColor: v
                      ? isMe
                        ? "#f97316"
                        : "#ffffff50"
                      : "#ffffff15",
                    color: v ? (isMe ? "#f97316" : "#ffffffcc") : "#ffffff20",
                  }}
                >
                  {v ? v.nickname[0].toUpperCase() : "?"}
                </div>
                <span
                  className="text-xs font-bold"
                  style={{
                    color: v ? (isMe ? "#f97316" : "#ffffff80") : "#ffffff20",
                  }}
                >
                  {v ? (isMe ? `${v.nickname} (나)` : v.nickname) : "???"}
                </span>
              </div>
            );
          })}
        </div>

        {/* 입장하기 버튼 → 대기 문구로 변환 */}
        <div className="w-full flex flex-col gap-3">
          <input
            type="text"
            value={myNickname.current}
            readOnly
            className="w-full px-5 py-4 rounded-2xl text-white/40 text-lg text-center font-bold outline-none"
            style={{ background: "#ffffff08", border: "2px solid #ffffff10" }}
          />
          <button
            disabled
            className="w-full py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-2"
            style={{
              background: "#f9731622",
              border: "2px solid #f9731644",
              color: "#f97316",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse inline-block" />
            {3 - viewerCount > 0
              ? `친구 ${3 - viewerCount}명을 기다리는 중...`
              : "곧 시작합니다! 🔥"}
          </button>
        </div>
        <p className="text-white/20 text-xs">
          3명이 모이면 자동으로 시작됩니다
        </p>
      </div>
    );
  }

  // ─── CELEBRATION: 폭죽만 (순위는 다음 단계) ───────────────────────────────
  if (phase === "CELEBRATION") {
    return (
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
        <p className="text-7xl mb-6">🎉</p>
        <p className="text-white font-black text-3xl text-center tracking-tight">
          MAX 우정!
        </p>
        <p className="text-white/45 text-sm mt-3">100° 달성</p>
      </div>
    );
  }

  // ─── RANKING: 탭 횟수 순위 ───────────────────────────────────────────────
  if (phase === "RANKING") {
    const medals = ["🥇", "🥈", "🥉"];
    const ranked = [...viewerEntries]
      .map(([sid, v]) => ({
        sid,
        nickname: v.nickname,
        taps: tapScores[sid] ?? 0,
      }))
      .sort((a, b) =>
        b.taps !== a.taps
          ? b.taps - a.taps
          : a.nickname.localeCompare(b.nickname, "ko"),
      );
    return (
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center px-6 py-10 gap-8">
        <div className="text-center">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.2em] mb-2">
            우정 온도 기여
          </p>
          <p className="text-white font-black text-2xl">탭 순위</p>
        </div>
        <ul className="flex flex-col gap-3 w-full max-w-sm">
          {ranked.map((row, i) => (
            <li
              key={row.sid}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
              style={{
                background:
                  row.sid === sessionId.current ? "#f9731618" : "#ffffff08",
                border: `1.5px solid ${
                  row.sid === sessionId.current ? "#f9731655" : "#ffffff18"
                }`,
              }}
            >
              <span className="text-2xl w-10 text-center shrink-0">
                {medals[i] ?? `${i + 1}위`}
              </span>
              <span className="text-white font-bold flex-1 min-w-0 truncate">
                {row.nickname}
                {row.sid === sessionId.current && (
                  <span className="text-orange-400 font-semibold text-sm ml-1">
                    (나)
                  </span>
                )}
              </span>
              <span
                className="text-orange-400 font-black tabular-nums text-lg shrink-0"
                style={{ textShadow: "0 0 20px rgba(249,115,22,0.35)" }}
              >
                {row.taps}탭
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (phase === "BLACKOUT") return <div className="w-full h-full bg-black" />;

  // ─── ABORTED ──────────────────────────────────────────────────────────────
  if (phase === "ABORTED") {
    return (
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-8 px-8">
        <div className="text-center">
          <p className="text-6xl mb-4">😢</p>
          <p className="text-white font-black text-2xl">게임이 중단됐습니다</p>
          <p className="text-white/40 text-sm mt-2">
            누군가 게임 도중 이탈하거나 새로고침했어요
          </p>
        </div>
      </div>
    );
  }

  if (phase === "REVEAL") {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        {hostStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover"
            style={{ transition: "none" }}
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
            <p className="text-white/60 text-sm">연결 중...</p>
          </div>
        )}
      </div>
    );
  }

  if (phase === "WAITING") {
    return (
      <>
        <GameAlert
          open={waitingBreakAlert !== null}
          title={waitingBreakAlert?.title ?? ""}
          lines={waitingBreakAlert?.lines ?? []}
          confirmLabel="알겠어요"
          onConfirm={handleWaitingBreakConfirm}
        />
        <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 px-6">
          <>
            <div className="text-center animate-pulse">
              <p className="text-5xl mb-4">🌡️</p>
              <p className="text-white/60 text-lg">잠시 후 시작됩니다...</p>
            </div>
            <div className="flex gap-2">
              {viewerEntries.map(([sid, v]) => (
                <div
                  key={sid}
                  className="px-3 py-1 rounded-full text-sm font-bold"
                  style={{
                    background: "#f9731622",
                    border: "1px solid #f97316",
                    color: "#f97316",
                  }}
                >
                  {v.nickname}
                </div>
              ))}
            </div>
          </>
        </div>
      </>
    );
  }

  // ─── PLAYING / CELEBRATION: 전체 화면 탭 ──────────────────────────────────
  const temp = eventState.temperature ?? 0;

  return (
    <div
      className="w-full h-full flex flex-col select-none"
      style={{ background: "#0a0a0a" }}
      onPointerDown={undefined}
    >
      {/* 상단: 참가자 */}
      <div className="flex justify-center gap-2 pt-6 px-4">
        {viewerEntries.map(([sid, v]) => (
          <span
            key={sid}
            className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{
              background:
                v.nickname === myNickname.current ? "#f9731633" : "#ffffff11",
              color:
                v.nickname === myNickname.current ? "#f97316" : "#ffffff50",
              border:
                v.nickname === myNickname.current
                  ? "1px solid #f97316"
                  : "1px solid transparent",
            }}
          >
            {v.nickname}
          </span>
        ))}
      </div>

      {/* 중앙: 게이지 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 pointer-events-none">
        <TemperatureGauge temperature={temp} />
        <p className="text-white/30 text-sm tracking-widest">
          {temp < 30 && "냉랭함 ❄️"}
          {temp >= 30 && temp < 60 && "따스함 🌤"}
          {temp >= 60 && temp < 90 && "뜨거움 🔥"}
          {temp >= 90 && temp < 100 && "불타는 중 💥"}
          {temp >= 100 && "MAX 우정! 🏆"}
        </p>
      </div>

      {/* 떠다니는 힌트 */}
      {showHint && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ animation: "hint-float 2s ease-in-out infinite" }}
        >
          <div
            className="px-6 py-4 rounded-2xl flex flex-col items-center gap-2 text-center"
            style={{
              background: "rgba(249,115,22,0.15)",
              border: "1.5px solid rgba(249,115,22,0.5)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 0 30px rgba(249,115,22,0.2)",
            }}
          >
            <span className="text-4xl">👇</span>
            <p className="text-white font-black text-base">버튼을 눌러</p>
            <p className="text-white font-black text-base">
              온도를 높여보세요!
            </p>
          </div>
          <style>{`
            @keyframes hint-float {
              0%, 100% { transform: translateY(0px); }
              50%      { transform: translateY(-10px); }
            }
          `}</style>
        </div>
      )}

      {/* 하단: 오락기 버튼 */}
      {phase === "PLAYING" && (
        <div className="pb-10 flex flex-col items-center gap-3">
          <button
            onPointerDown={handleTap}
            className="rounded-full flex items-center justify-center select-none"
            style={{
              width: 160,
              height: 160,
              background: tapFlash
                ? "radial-gradient(circle at 35% 30%, #ffb347, #cc2200)"
                : "radial-gradient(circle at 35% 30%, #ff7c3a, #e03000)",
              boxShadow: tapFlash
                ? "0 3px 0 #880000, 0 6px 20px rgba(0,0,0,0.6), inset 0 2px 6px rgba(255,180,80,0.5)"
                : "0 8px 0 #880000, 0 14px 30px rgba(0,0,0,0.5), inset 0 3px 8px rgba(255,180,80,0.4)",
              transform: tapFlash ? "translateY(5px)" : "translateY(0px)",
              transition: "transform 0.08s, box-shadow 0.08s, background 0.08s",
              border: "3px solid rgba(255,120,50,0.6)",
            }}
          >
            <span
              style={{
                fontSize: 56,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
              }}
            >
              🔥
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
