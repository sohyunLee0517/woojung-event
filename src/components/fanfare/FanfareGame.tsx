"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TemperatureGauge from "@/components/TemperatureGauge";
import { getAudioContext, playFanfare, playTudum, resumeAudio } from "@/lib/sounds";
import {
  canStartFanfare,
  derivePhase,
  effectiveTemperature,
  hostEndAction,
  initialState,
  tapRanking,
  temperatureLabel,
  type FanfareState,
} from "@/lib/fanfare/logic";
import { signInWithCustomToken } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import {
  announceHost,
  hostOffline,
  hostStart,
  joinAsPlayer,
  serverNow,
  tap,
  watchHost,
  watchPlayers,
  watchState,
  watchTaps,
  type FanfareHostInfo,
  type FanfarePlayer,
} from "@/lib/fanfare/store";
import { FanfareHost, FanfareViewer, openCamera } from "@/lib/fanfare/rtc";
import { cameraErrorMessage } from "@/lib/fanfare/camera";
import TopBar from "@/components/ukiki/TopBar";
import { ghostButton, primaryButton, UK } from "@/components/ukiki/styles";

type Me = { id: string; name: string; image: string | null };

async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  const end = Date.now() + 3000;
  const shoot = () => {
    confetti({
      particleCount: 60,
      spread: 80,
      origin: { x: Math.random(), y: Math.random() * 0.4 },
      colors: ["#ff0044", "#ff6b35", "#ffd700", "#00e5ff", "#b347ff"],
      zIndex: 80,
    });
    if (Date.now() < end) requestAnimationFrame(shoot);
  };
  shoot();
}

const center: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  textAlign: "center",
  padding: "0 16px 40px",
};

export default function FanfareGame({
  gameId,
  roomCode,
  me,
  isHost,
  hostName,
  devAs,
}: {
  gameId: number;
  roomCode: string;
  me: Me;
  isHost: boolean;
  hostName: string;
  /** 로컬 개발에서만: 테스트 친구로 입장 */
  devAs?: string | null;
}) {
  const [state, setState] = useState<FanfareState>(initialState());
  const [players, setPlayers] = useState<Record<string, FanfarePlayer>>({});
  const [taps, setTaps] = useState<Record<string, number>>({});
  const [host, setHost] = useState<FanfareHostInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  const [connError, setConnError] = useState(false);
  const [ended, setEnded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [tapFlash, setTapFlash] = useState(false);

  // 호스트 카메라
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const hostRtcRef = useRef<FanfareHost | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  // 친구 영상
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const playerCount = Math.max(1, Object.keys(players).length);

  // ── 실시간 입장권으로 Firebase 로그인 (카카오 로그인 + 방 멤버만 받을 수 있다) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/ukiki/rooms/${roomCode}/fanfare/${gameId}/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ devAs: devAs ?? undefined }),
      }).catch(() => null);
      const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; token?: string; reason?: string } | null) : null;
      if (cancelled) return;
      if (!data?.ok || !data.token) {
        if (data?.reason === "not_active") setEnded(true);
        else setConnError(true);
        return;
      }
      try {
        await signInWithCustomToken(firebaseAuth(), data.token);
        if (!cancelled) setSignedIn(true);
      } catch (e) {
        console.error("[fanfare] 입장권 로그인 실패", e);
        if (!cancelled) setConnError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomCode, gameId, devAs]);

  // ── 구독 ──
  useEffect(() => {
    if (!signedIn) return;
    const u1 = watchState(
      gameId,
      (s) => {
        setState(s);
        setReady(true);
      },
      async () => {
        // 호스트가 끝내면 서버가 실시간 데이터를 지워서 권한이 사라진다 → 끝났는지 확인
        const res = await fetch(`/api/ukiki/rooms/${roomCode}/fanfare/${gameId}/token`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ devAs: devAs ?? undefined }),
        }).catch(() => null);
        const data = res ? ((await res.json().catch(() => null)) as { reason?: string } | null) : null;
        if (data?.reason === "not_active") setEnded(true);
        else setConnError(true);
      },
    );
    const u2 = watchPlayers(gameId, setPlayers);
    const u3 = watchTaps(gameId, setTaps);
    const u4 = watchHost(gameId, setHost);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [gameId, signedIn]);

  // 참가자 접속 표시 (호스트는 참가자로 세지 않는다)
  useEffect(() => {
    if (isHost || !signedIn) return;
    return joinAsPlayer(gameId, me);
  }, [gameId, isHost, me, signedIn]);

  // 화면 시계 (단계·온도는 서버 시각으로 계산)
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 150);
    return () => clearInterval(t);
  }, []);

  const { phase } = derivePhase(state, now);
  const temp = effectiveTemperature(state, now);

  // 효과음·폭죽은 단계에 처음 들어갈 때 한 번씩
  const firedRef = useRef<string>("");
  useEffect(() => {
    const key = `${state.celebratedAt}-${phase}`;
    if (firedRef.current === key) return;
    firedRef.current = key;
    if (phase === "CELEBRATION") {
      void fireConfetti();
      playFanfare();
    }
    if (phase === "REVEAL") setTimeout(() => playTudum(), 100);
  }, [phase, state.celebratedAt]);

  // ── 호스트: 카메라 & 영상 송출 ──
  const cameraBusyRef = useRef(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const startCamera = useCallback(async () => {
    // 두 번 눌러도 카메라를 두 번 열지 않는다
    if (streamRef.current || cameraBusyRef.current) return;
    cameraBusyRef.current = true;
    setCameraStarting(true);
    setCameraError("");
    try {
      const stream = await openCamera();
      streamRef.current = stream;
      const epoch = Date.now();
      const rtc = new FanfareHost(gameId, epoch, stream);
      rtc.start();
      hostRtcRef.current = rtc;
      await announceHost(gameId, me.id, epoch);
      setCameraOn(true);
    } catch (e) {
      console.warn("[fanfare] 카메라 실패", e);
      setCameraError(cameraErrorMessage(e));
    } finally {
      cameraBusyRef.current = false;
      setCameraStarting(false);
    }
  }, [gameId, me.id]);

  const stopCamera = useCallback(async () => {
    await hostRtcRef.current?.stop();
    hostRtcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    await hostOffline(gameId).catch(() => {});
  }, [gameId]);

  // 미리보기는 video 요소가 항상 있게 두고 stream 만 바꿔 끼운다
  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = cameraOn ? streamRef.current : null;
  }, [cameraOn, phase]);

  // 호스트 화면을 떠나면 카메라·연결 정리
  useEffect(() => {
    if (!isHost) return;
    return () => {
      void hostRtcRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void hostOffline(gameId).catch(() => {});
    };
  }, [gameId, isHost]);

  // 공개 단계가 되면 호스트가 결과를 저장 (한 번만)
  const savedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isHost || phase !== "REVEAL" || state.celebratedAt === null || savedRef.current === state.celebratedAt) return;
    savedRef.current = state.celebratedAt;
    void fetch(`/api/ukiki/rooms/${roomCode}/fanfare/${gameId}/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taps }),
    }).catch(() => {});
  }, [isHost, phase, state.celebratedAt, taps, roomCode, gameId]);

  // ── 친구: 공개 단계에서만 영상 받기 ──
  useEffect(() => {
    if (isHost || phase !== "REVEAL") {
      setHostStream(null);
      return;
    }
    const viewer = new FanfareViewer(gameId, me.id, setHostStream);
    viewer.start();
    return () => viewer.stop();
  }, [isHost, phase, gameId, me.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hostStream) return;
    v.srcObject = hostStream;
    v.muted = false;
    v.play().catch(() => {
      // iOS 등: 소리 있는 자동재생이 막히면 음소거로라도 틀고 '소리 켜기' 버튼을 보여 준다
      v.muted = true;
      setNeedsUnmute(true);
      void v.play().catch(() => {});
    });
  }, [hostStream]);

  const unlockSound = async () => {
    await resumeAudio();
    getAudioContext();
    setSoundOn(true);
  };

  const onTap = async () => {
    void resumeAudio(); // iOS 에서 끊긴 소리 다시 살리기
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
    await tap(gameId, me.id, playerCount);
  };

  const [confirmEnd, setConfirmEnd] = useState(false);
  const finish = async () => {
    const { outcome } = hostEndAction(phase);
    await stopCamera();
    await fetch(`/api/ukiki/rooms/${roomCode}/fanfare`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: gameId, outcome }),
    }).catch(() => null);
    location.href = `/r/${roomCode}`;
  };

  const playerList = Object.entries(players)
    .map(([id, p]) => ({ id, name: p.name, image: p.image }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const ranking = tapRanking(playerList, taps);
  const hostOnline = !!host?.online;

  // ── 화면 ──
  if (ended) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 40 }}>🏁</p>
        <p style={{ fontWeight: 800 }}>빵빠레가 끝났어요</p>
        <p style={{ fontSize: 13, opacity: 0.6 }}>결과는 방의 &apos;지난 게임&apos;에서 볼 수 있어요</p>
        <a href={`/r/${roomCode}`} style={{ ...primaryButton, textDecoration: "none" }}>
          방으로 돌아가기
        </a>
      </div>
    );
  }

  if (connError) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 40 }}>📡</p>
        <p style={{ fontWeight: 800 }}>실시간 연결이 막혀 있어요</p>
        <p style={{ fontSize: 13, opacity: 0.6 }}>잠시 후 다시 시도해 주세요. 계속되면 방장에게 알려 주세요.</p>
        <a href={`/r/${roomCode}`} style={{ ...ghostButton, textDecoration: "none" }}>
          방으로
        </a>
      </div>
    );
  }

  if (!ready) return <div style={{ position: "absolute", inset: 0, background: "#0a0a0a" }} />;

  if (phase === "BLACKOUT") return <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 70 }} />;

  if (!isHost && phase === "REVEAL") {
    return (
      <div style={{ position: "absolute", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {hostStream ? (
          <video ref={videoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "#fff" }}>
            <div className="w-12 h-12 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
            <p style={{ opacity: 0.6, fontSize: 14 }}>{hostOnline ? "연결 중..." : `${hostName}님 카메라를 기다리는 중...`}</p>
          </div>
        )}
        {needsUnmute && (
          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.muted = false;
              setNeedsUnmute(false);
            }}
            style={{ ...primaryButton, position: "absolute", bottom: 32 }}
          >
            🔊 소리 켜기
          </button>
        )}
      </div>
    );
  }

  const header = (
    <TopBar
      backHref={`/r/${roomCode}`}
      title="🎉 빵빠레"
      sub={
        <p style={{ fontSize: 12, opacity: 0.6 }}>
          {isHost ? "내가 호스트" : `호스트 ${hostName}`} · 👥 {playerList.length}명 참여
          {!isHost && host && !host.online && " · 호스트 카메라 꺼짐"}
        </p>
      }
    />
  );

  const chips = (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
      {playerList.length === 0 && <span style={{ fontSize: 13, opacity: 0.5 }}>아직 들어온 친구가 없어요</span>}
      {playerList.map((p) => (
        <span
          key={p.id}
          style={{
            fontSize: 12,
            padding: "3px 10px",
            borderRadius: 999,
            fontWeight: 700,
            background: p.id === me.id ? "#f9731633" : "rgba(255,255,255,.08)",
            color: p.id === me.id ? "#f97316" : "#fff",
            border: p.id === me.id ? "1px solid #f97316" : "1px solid transparent",
          }}
        >
          {p.name}
          {p.id === me.id ? " (나)" : ""}
        </span>
      ))}
    </div>
  );

  const rankingView = (
    <div style={center}>
      <p style={{ fontSize: 12, opacity: 0.5, letterSpacing: 3 }}>우정 온도 기여</p>
      <p style={{ fontSize: 24, fontWeight: 900 }}>탭 순위</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 8 }}>
        {ranking.map((r) => (
          <li
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 14,
              background: r.id === me.id ? "#f9731618" : "rgba(255,255,255,.05)",
              border: `1.5px solid ${r.id === me.id ? "#f9731655" : "rgba(255,255,255,.1)"}`,
            }}
          >
            <span style={{ width: 36, fontSize: 20 }}>{r.medal || `${r.rank}위`}</span>
            <span style={{ flex: 1, textAlign: "left", fontWeight: 700 }}>
              {r.name}
              {r.id === me.id ? " (나)" : ""}
            </span>
            <span style={{ color: "#f97316", fontWeight: 900 }}>{r.taps}탭</span>
          </li>
        ))}
      </ul>
    </div>
  );

  // ── 호스트 화면 ──
  if (isHost) {
    return (
      <div style={{ position: "absolute", inset: 0, overflowY: "auto", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {header}

          <section style={{ padding: 14, borderRadius: 16, background: UK.card, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <b>📷 내 카메라</b>
              <button
                onClick={cameraOn ? stopCamera : startCamera}
                disabled={cameraStarting}
                style={{ ...ghostButton, padding: "6px 12px", opacity: cameraStarting ? 0.6 : 1 }}
              >
                {cameraStarting ? "켜는 중…" : cameraOn ? "끄기" : "켜기"}
              </button>
            </div>
            <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", background: "#000" }}>
              <video ref={previewRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: cameraOn ? "block" : "none" }} />
              {!cameraOn && (
                <p style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, opacity: 0.5 }}>
                  100도가 되면 친구들 화면에 내 카메라가 나와요
                </p>
              )}
            </div>
            {cameraError && <p style={{ color: "#f97316", fontSize: 13 }}>{cameraError}</p>}
          </section>

          <section style={{ padding: 14, borderRadius: 16, background: UK.card, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <p style={{ fontSize: 13, opacity: 0.6 }}>
              {phase === "WAITING" && "⏳ 대기 중"}
              {phase === "PLAYING" && "🎮 진행 중"}
              {phase === "CELEBRATION" && "🎉 폭죽!"}
              {phase === "RANKING" && "🏆 순위 발표"}
              {phase === "REVEAL" && "🎬 공개 중 — 친구들이 내 카메라를 보고 있어요"}
            </p>
            {phase === "RANKING" ? rankingView : <TemperatureGauge temperature={temp} />}
            {chips}
          </section>

          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {phase === "WAITING" &&
              (() => {
                const check = canStartFanfare({ cameraOn, playerCount: playerList.length });
                return (
                  <>
                    <button
                      onClick={() => hostStart(gameId)}
                      disabled={!check.ok}
                      style={{ ...primaryButton, opacity: check.ok ? 1 : 0.5 }}
                    >
                      🎮 게임 시작 (나 + 친구 {playerList.length}명)
                    </button>
                    {check.reason && <p style={{ fontSize: 13, color: UK.yellow, textAlign: "center" }}>{check.reason}</p>}
                  </>
                );
              })()}
            {(() => {
              const action = hostEndAction(phase);
              const danger = action.outcome === "aborted";
              return confirmEnd && danger ? (
                <div style={{ padding: 14, borderRadius: 14, background: "rgba(220,38,38,.12)", border: "1px solid rgba(220,38,38,.5)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>게임을 중단할까요?</p>
                  <p style={{ fontSize: 12, opacity: 0.7 }}>방의 지난 게임에 &apos;중단&apos;으로 기록돼요.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setConfirmEnd(false)} style={{ ...ghostButton, flex: 1 }}>
                      계속하기
                    </button>
                    <button onClick={finish} style={{ ...ghostButton, flex: 1, background: "#dc2626" }}>
                      중단하기
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => (danger ? setConfirmEnd(true) : finish())}
                  style={{ ...ghostButton, padding: 14, color: danger ? "#f87171" : "#fff" }}
                >
                  {action.label}
                </button>
              );
            })()}
          </section>
        </div>
      </div>
    );
  }

  // ── 친구 화면 ──
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", color: "#fff", fontFamily: "sans-serif", userSelect: "none" }}>
      <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
        {header}

        {phase === "WAITING" && (
          <div style={center}>
            <p style={{ fontSize: 56 }}>🌡️</p>
            <p style={{ fontSize: 18, fontWeight: 800 }}>{hostName}님이 시작하길 기다리는 중</p>
            {chips}
            {!soundOn ? (
              <button onClick={unlockSound} style={primaryButton}>
                🔊 소리 켜고 준비하기
              </button>
            ) : (
              <p style={{ fontSize: 13, color: UK.yellow }}>준비 완료! 곧 시작해요</p>
            )}
          </div>
        )}

        {phase === "PLAYING" && (
          <>
            <div style={{ ...center, gap: 12 }}>
              {chips}
              <TemperatureGauge temperature={temp} />
              <p style={{ opacity: 0.4, fontSize: 14, letterSpacing: 3 }}>{temperatureLabel(temp)}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 32 }}>
              <button
                onPointerDown={onTap}
                aria-label="온도 올리기"
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  fontSize: 56,
                  background: tapFlash ? "radial-gradient(circle at 35% 30%, #ffb347, #cc2200)" : "radial-gradient(circle at 35% 30%, #ff7c3a, #e03000)",
                  boxShadow: tapFlash ? "0 3px 0 #880000, 0 6px 20px rgba(0,0,0,.6)" : "0 8px 0 #880000, 0 14px 30px rgba(0,0,0,.5)",
                  transform: tapFlash ? "translateY(5px)" : "none",
                  transition: "transform .08s, box-shadow .08s",
                  border: "3px solid rgba(255,120,50,.6)",
                  touchAction: "manipulation",
                }}
              >
                🔥
              </button>
            </div>
          </>
        )}

        {phase === "CELEBRATION" && (
          <div style={center}>
            <p style={{ fontSize: 72 }}>🎉</p>
            <p style={{ fontSize: 30, fontWeight: 900 }}>MAX 우정!</p>
            <p style={{ opacity: 0.45, fontSize: 14 }}>100° 달성</p>
          </div>
        )}

        {phase === "RANKING" && rankingView}
      </div>
    </div>
  );
}
