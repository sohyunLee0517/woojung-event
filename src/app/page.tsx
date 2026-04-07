"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { EventState } from "@/lib/types";
import {
  watchEventState,
  setTemperature,
  watchViewers,
  tryJoinViewer,
  leaveViewer,
  watchContributions,
  incrementContribution,
  type ViewerInfo,
  type ContributionInfo,
} from "@/lib/event-store";
import { getAudioContext, resumeAudio, playFanfare, playTudum } from "@/lib/sounds";
import { ViewerReceiver } from "@/lib/webrtc";
import TemperatureGauge from "@/components/TemperatureGauge";

type Phase = "GATE" | "LOBBY" | "WAITING" | "PLAYING" | "CELEBRATION" | "RANKING" | "BLACKOUT" | "REVEAL" | "ABORTED";

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
  const [eventState, setEventState] = useState<EventState>({ status: "WAITING", temperature: 0 });
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [tapFlash, setTapFlash] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [contributions, setContributions] = useState<Record<string, ContributionInfo>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const receiverRef = useRef<ViewerReceiver | null>(null);
  const phaseRef = useRef<Phase>("GATE");
  const tempRef = useRef(0);
  const tapCooldown = useRef(false);
  const sessionId = useRef(crypto.randomUUID());
  const myNickname = useRef("");

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { tempRef.current = eventState.temperature ?? 0; }, [eventState.temperature]);

  useEffect(() => {
    if (videoRef.current && hostStream) videoRef.current.srcObject = hostStream;
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

      // WAITING 중 누군가 이탈 → 내 세션 정리 후 GATE로 복귀
      if (phaseRef.current === "WAITING" && Object.keys(v).length < 3) {
        leaveViewer(sessionId.current);
        myNickname.current = "";
        setPhase("GATE");
        return;
      }

      // 내 세션이 사라졌다 = 호스트가 초기화 → GATE로 복귀
      // (ABORTED 포함: 호스트 "다시 하기" 시 세션 삭제로도 감지)
      const iJoined = phaseRef.current !== "GATE" && myNickname.current !== "";
      if (iJoined && !v[sessionId.current]) {
        myNickname.current = "";
        setPhase("GATE");
        return;
      }
    });
    return () => unsub();
  }, [phase]);

  const handleStatusChange = useCallback((newStatus: string) => {
    const cur = phaseRef.current;
    // GATE·LOBBY 는 Firebase 상태 무시 — 3명이 모여 WAITING이 된 뒤에만 반응
    if (cur === "GATE" || cur === "LOBBY") return;

    // phaseRef 기반 중복 방지 (이미 해당 phase면 무시)
    // ABORTED 중 WAITING 수신 = 호스트가 리셋 → GATE로 복귀
    if (newStatus === "WAITING" && cur !== "WAITING") {
      if (cur === "ABORTED") { myNickname.current = ""; setPhase("GATE"); return; }
      setPhase("WAITING");
    }
    if (newStatus === "PLAYING"     && cur !== "PLAYING")     { setPhase("PLAYING"); setShowHint(true); }
    if (newStatus === "CELEBRATION" && cur !== "CELEBRATION") { setPhase("CELEBRATION"); fireConfetti(); playFanfare(); }
    if (newStatus === "RANKING"     && cur !== "RANKING")     setPhase("RANKING");
    if (newStatus === "BLACKOUT"    && cur !== "BLACKOUT")    setPhase("BLACKOUT");
    if (newStatus === "REVEAL"      && cur !== "REVEAL")      { setPhase("REVEAL"); setTimeout(() => playTudum(), 100); }
    if (newStatus === "ABORTED"     && cur !== "ABORTED")     setPhase("ABORTED");
  }, []);

  useEffect(() => {
    const unsub = watchEventState((state) => {
      const cur = phaseRef.current;
      // GATE에서도 ABORTED 신호를 받으면 중단 화면 표시
      // (이탈했다 다시 들어온 플레이어 포함, 모든 방문자에게 적용)
      if (cur === "GATE") {
        if (state.status === "ABORTED") setPhase("ABORTED");
        return;
      }
      setEventState(state);
      handleStatusChange(state.status);
    });
    return () => unsub();
  }, [phase, handleStatusChange]);

  useEffect(() => {
    if (phase === "GATE") return;
    const receiver = new ViewerReceiver();
    receiverRef.current = receiver;
    receiver.connect((stream) => setHostStream(stream));
    return () => { receiver.disconnect(); receiverRef.current = null; };
  }, [phase]);

  // 기여도 구독
  useEffect(() => {
    if (phase === "GATE") return;
    const unsub = watchContributions(setContributions);
    return () => unsub();
  }, [phase]);

  // 페이지 떠날 때 참가자 제거
  useEffect(() => {
    return () => { leaveViewer(sessionId.current); };
  }, []);

  const handleEnter = async () => {
    const name = nickname.trim();
    if (!name) { setJoinError("별명을 입력해주세요"); return; }
    setJoining(true);
    setJoinError("");

    await resumeAudio();
    getAudioContext();

    const result = await tryJoinViewer(sessionId.current, name);
    if (result === "full") {
      setJoinError("이미 3명이 입장했습니다 😢");
      setJoining(false);
      return;
    }
    if (result === "duplicate") {
      setJoinError("이미 사용 중인 별명이에요 🙈");
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
    setTimeout(() => { tapCooldown.current = false; }, 300);
    setShowHint(false); // 첫 탭에 즉시 숨김
    const count = Math.max(1, Object.keys(viewers).length);
    const gain = 2 / count; // 1명: +2, 2명: +1, 3명: +0.67
    const next = Math.min(100, (tempRef.current ?? 0) + gain);
    await setTemperature(next);
    await incrementContribution(sessionId.current, myNickname.current, gain);
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 150);
  };

  const viewerEntries = Object.entries(viewers); // [sessionId, ViewerInfo][]
  const viewerList = viewerEntries.map(([, info]) => info);
  const viewerCount = viewerEntries.length;

  // ─── GATE ─────────────────────────────────────────────────────────────────
  if (phase === "GATE") {
    return (
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-8 px-8">
        <div className="text-center">
          <p className="text-6xl mb-3">🌡️</p>
          <h1 className="text-3xl font-black text-white tracking-tight">우정의 온도</h1>
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
          <span className="text-white/40 text-sm ml-1">{viewerCount}/3명 입장</span>
        </div>

        {/* 별명 입력 */}
        <div className="w-full flex flex-col gap-3">
          <input
            type="text"
            value={nickname}
            onChange={(e) => { setNickname(e.target.value); setJoinError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleEnter(); }}
            placeholder="별명을 입력하세요"
            maxLength={8}
            className="w-full px-5 py-4 rounded-2xl text-white text-lg text-center font-bold
                       outline-none placeholder:text-white/30"
            style={{ background: "#ffffff11", border: "2px solid #ffffff22" }}
            autoFocus
          />
          {joinError && (
            <p className="text-red-400 text-sm text-center">{joinError}</p>
          )}
          <button
            onClick={handleEnter}
            disabled={joining || viewerCount >= 3}
            className="w-full py-4 rounded-2xl text-lg font-bold text-white
                       disabled:opacity-40 active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #f97316, #ef4444)",
              boxShadow: "0 0 30px rgba(249,115,22,0.4)",
            }}
          >
            {joining ? "입장 중..." : viewerCount >= 3 ? "입장 마감" : "입장하기 🔥"}
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
          <h1 className="text-3xl font-black text-white tracking-tight">우정의 온도</h1>
          <p className="text-white/40 mt-2 text-sm">The Dramatic Reveal</p>
        </div>

        {/* 참가자 슬롯 */}
        <div className="flex gap-3 items-center">
          {[0, 1, 2].map((i) => {
            const v = viewerList[i];
            const isMe = v?.nickname === myNickname.current;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 transition-all duration-300">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black border-2 transition-all duration-300"
                  style={{
                    background: v ? (isMe ? "#f9731633" : "#ffffff15") : "#ffffff08",
                    borderColor: v ? (isMe ? "#f97316" : "#ffffff50") : "#ffffff15",
                    color: v ? (isMe ? "#f97316" : "#ffffffcc") : "#ffffff20",
                  }}
                >
                  {v ? v.nickname[0].toUpperCase() : "?"}
                </div>
                <span className="text-xs font-bold" style={{ color: v ? (isMe ? "#f97316" : "#ffffff80") : "#ffffff20" }}>
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
        <p className="text-white/20 text-xs">3명이 모이면 자동으로 시작됩니다</p>
      </div>
    );
  }

  if (phase === "BLACKOUT") return <div className="w-full h-full bg-black" />;

  // ─── RANKING ──────────────────────────────────────────────────────────────
  if (phase === "RANKING") {
    const rankingData = Object.entries(viewers)
      .map(([sid, v]) => ({
        sid,
        nickname: v.nickname,
        total: Math.round((contributions[sid]?.total ?? 0) * 10) / 10,
      }))
      .sort((a, b) => b.total - a.total);

    const medals = ["🥇", "🥈", "🥉"];
    const borderColors = ["#f59e0b", "#9ca3af", "#b45309"];
    const glowColors = ["#f59e0b44", "#9ca3af22", "#b4530922"];
    const textColors = ["#fbbf24", "#e5e7eb", "#d97706"];
    const rankLabels = ["1위", "2위", "3위"];

    return (
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-5 px-6">
        <div className="text-center">
          <p className="text-5xl mb-2">🏆</p>
          <h2 className="text-2xl font-black text-white">우정 온도 랭킹</h2>
          <p className="text-white/30 text-sm mt-1">누가 가장 열심히 눌렀을까?</p>
        </div>

        <div className="w-full flex flex-col gap-3">
          {rankingData.map((r, i) => (
            <div
              key={r.sid}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{
                background: glowColors[i],
                border: `2px solid ${borderColors[i]}`,
                animation: "rank-in 0.5s cubic-bezier(0.22,1,0.36,1) both",
                animationDelay: `${i * 0.2}s`,
              }}
            >
              <span style={{ fontSize: 40, lineHeight: 1 }}>{medals[i]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-xl truncate">{r.nickname}</p>
                <p className="text-white/30 text-xs">{rankLabels[i]}</p>
              </div>
              <span
                className="font-black text-2xl tabular-nums shrink-0"
                style={{ color: textColors[i] }}
              >
                +{r.total.toFixed(1)}°
              </span>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes rank-in {
            from { opacity: 0; transform: translateY(24px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0)    scale(1);    }
          }
        `}</style>
      </div>
    );
  }

  // ─── ABORTED ──────────────────────────────────────────────────────────────
  if (phase === "ABORTED") {
    return (
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 px-8">
        <div className="text-center">
          <p className="text-6xl mb-4">😢</p>
          <p className="text-white font-black text-2xl">게임이 중단됐습니다</p>
          <p className="text-white/40 text-sm mt-2">호스트가 게임을 다시 시작하면<br />새 게임이 시작됩니다</p>
        </div>
      </div>
    );
  }

  if (phase === "REVEAL") {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        {hostStream ? (
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover" style={{ transition: "none" }} />
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
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 px-6">
        <>
          <div className="text-center animate-pulse">
            <p className="text-5xl mb-4">🌡️</p>
            <p className="text-white/60 text-lg">잠시 후 시작됩니다...</p>
          </div>
          <div className="flex gap-2">
            {viewerEntries.map(([sid, v]) => (
              <div key={sid}
                className="px-3 py-1 rounded-full text-sm font-bold"
                style={{ background: "#f9731622", border: "1px solid #f97316", color: "#f97316" }}
              >
                {v.nickname}
              </div>
            ))}
          </div>
        </>
      </div>
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
      {/* 상단: 참가자 + 기여도 */}
      <div className="flex justify-center gap-3 pt-5 px-4">
        {viewerEntries.map(([sid, v]) => {
          const contrib = contributions[sid];
          const total = contrib?.total ?? 0;
          const isMe = v.nickname === myNickname.current;
          return (
            <div key={sid} className="flex flex-col items-center gap-0.5">
              <span
                className="text-xs px-2.5 py-1 rounded-full font-bold"
                style={{
                  background: isMe ? "#f9731633" : "#ffffff11",
                  color: isMe ? "#f97316" : "#ffffff50",
                  border: isMe ? "1px solid #f97316" : "1px solid #ffffff20",
                }}
              >
                {v.nickname}
              </span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: isMe ? "#fb923c" : "#ffffff30" }}>
                +{total.toFixed(1)}°
              </span>
            </div>
          );
        })}
      </div>

      {/* 중앙: 게이지 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 pointer-events-none">
        {phase === "CELEBRATION" && (
          <p
            className="text-4xl font-black animate-bounce px-6 py-3 rounded-2xl"
            style={{
              color: "#fff",
              background: "rgba(239,68,68,0.85)",
              boxShadow: "0 0 40px #ef444488",
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            🎉 축하합니다! 🎉
          </p>
        )}
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
            <p className="text-white font-black text-base">온도를 높여보세요!</p>
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
            <span style={{ fontSize: 56, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>🔥</span>
          </button>
        </div>
      )}
    </div>
  );
}
