"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventStatus } from "@/lib/types";
import {
  watchEventState,
  setStatus,
  setTemperature,
  resetEvent,
  watchViewers,
  type ViewerInfo,
} from "@/lib/event-store";
import { HostBroadcaster } from "@/lib/webrtc";
import TemperatureGauge from "@/components/TemperatureGauge";

const STATUS_LABELS: Record<EventStatus, string> = {
  WAITING: "⏳ 대기 중",
  PLAYING: "🎮 진행 중",
  CELEBRATION: "🎉 폭죽!",
  RANKING: "🏆 순위",
  BLACKOUT: "⬛ 암전",
  REVEAL: "🎬 등장",
  ABORTED: "🚨 중단됨",
};

const STATUS_COLORS: Record<EventStatus, string> = {
  WAITING: "#6b7280",
  PLAYING: "#22c55e",
  CELEBRATION: "#f59e0b",
  RANKING: "#a855f7",
  BLACKOUT: "#1f2937",
  REVEAL: "#ef4444",
  ABORTED: "#ef4444",
};

/** 이탈 시 중단 처리할 진행 단계 (누군가 새로고침·이탈) */
const ABORT_ON_LEAVE: readonly EventStatus[] = [
  "PLAYING",
  "CELEBRATION",
  "RANKING",
  "BLACKOUT",
  "REVEAL",
];

export default function HostPage() {
  const [status, setStatusLocal] = useState<EventStatus>("WAITING");
  const [temperature, setTempLocal] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [viewers, setViewers] = useState<Record<string, ViewerInfo>>({});
  const [showStartAlert, setShowStartAlert] = useState(false);
  const [earlyLeaveNames, setEarlyLeaveNames] = useState<string[]>([]);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const broadcasterRef = useRef<HostBroadcaster | null>(null);
  const seqTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tempRef = useRef(0);
  const statusRef = useRef<EventStatus>("WAITING");
  const decayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seqRunningRef = useRef(false); // stale closure 방지용 ref

  /** 폭죽 → 순위 → 암전 3초 → 두둥+영상 */
  const CELEBRATION_MS = 3000;
  const RANKING_MS = 4000;
  const BLACKOUT_MS = 3000;

  const startSequence = useCallback(() => {
    if (seqRunningRef.current) return;
    seqRunningRef.current = true;

    setStatus("CELEBRATION");

    const t1 = setTimeout(() => setStatus("RANKING"), CELEBRATION_MS);
    const t2 = setTimeout(
      () => setStatus("BLACKOUT"),
      CELEBRATION_MS + RANKING_MS
    );
    const t3 = setTimeout(() => {
      setStatus("REVEAL");
      seqRunningRef.current = false;
    }, CELEBRATION_MS + RANKING_MS + BLACKOUT_MS);

    seqTimersRef.current = [t1, t2, t3];
  }, []);

  // 참가자 감시 — 3명 모이면 자동 시작 알럿 / 게임 중 이탈 감지
  const prevViewersRef = useRef<Record<string, ViewerInfo>>({});
  useEffect(() => {
    const unsub = watchViewers((v) => {
      const prev = prevViewersRef.current;
      prevViewersRef.current = v;
      setViewers(v);

      const count = Object.keys(v).length;

      // 3명 모이면 알럿
      if (count >= 3 && statusRef.current === "WAITING") {
        setShowStartAlert(true);
      } else if (count < 3) {
        setShowStartAlert(false);
      }

      // 진행 중 이탈·새로고침(onDisconnect) 감지 → ABORTED
      if (ABORT_ON_LEAVE.includes(statusRef.current)) {
        const left = Object.keys(prev).filter((id) => !v[id]);
        if (left.length > 0) {
          const names = left.map((id) => prev[id].nickname);
          setEarlyLeaveNames(names);
          setStatus("ABORTED");
        }
      }
    });
    return () => unsub();
  }, []);

  // Firebase 상태 구독 + 100도 자동 시퀀스
  useEffect(() => {
    const unsub = watchEventState((state) => {
      setStatusLocal(state.status);
      setTempLocal(state.temperature ?? 0);
      tempRef.current = state.temperature ?? 0;
      statusRef.current = state.status;

      if ((state.temperature ?? 0) >= 100 && state.status === "PLAYING") {
        startSequence();
      }
    });
    return () => unsub();
  }, [startSequence]);

  // 자동 온도 하락: PLAYING 중 1초마다 (탭 상승과 균형 — 너무 느리게 떨어지지 않게 약하게)
  const TEMP_DECAY_PER_SEC = 0.12;
  useEffect(() => {
    if (status !== "PLAYING") {
      if (decayRef.current) { clearInterval(decayRef.current); decayRef.current = null; }
      return;
    }
    decayRef.current = setInterval(() => {
      if (statusRef.current !== "PLAYING") return;
      const next = Math.max(0, tempRef.current - TEMP_DECAY_PER_SEC);
      setTemperature(next);
    }, 1000);
    return () => { if (decayRef.current) { clearInterval(decayRef.current); decayRef.current = null; } };
  }, [status]);

  const startCamera = useCallback(async () => {
    const broadcaster = new HostBroadcaster();
    broadcasterRef.current = broadcaster;
    const stream = await broadcaster.startCamera();
    broadcaster.watchViewers();
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
    setCameraOn(true);
  }, []);

  const stopCamera = useCallback(() => {
    broadcasterRef.current?.stop();
    broadcasterRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  // ABORTED 시 카메라 강제 종료 (공개 단계 포함)
  useEffect(() => {
    if (status === "ABORTED") stopCamera();
  }, [status, stopCamera]);

  const handleTempChange = async (delta: number) => {
    const next = Math.round((temperature + delta) * 10) / 10;
    const clamped = Math.min(100, Math.max(0, next));
    await setTemperature(clamped);
  };

  const handleSlider = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await setTemperature(parseFloat(e.target.value));
  };

  const handleManualReveal = () => {
    seqTimersRef.current.forEach(clearTimeout);
    seqRunningRef.current = false;
    startSequence();
  };

  const handleReset = async () => {
    seqTimersRef.current.forEach(clearTimeout);
    seqRunningRef.current = false;
    setEarlyLeaveNames([]);
    await resetEvent();
  };

  const bgColor = STATUS_COLORS[status];

  return (
    <div className="w-full h-full bg-[#0f0f0f] flex flex-col overflow-auto">
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-5 py-4 transition-colors duration-500"
        style={{ background: bgColor + "33", borderBottom: `2px solid ${bgColor}` }}
      >
        <div>
          <h1 className="text-white font-black text-lg">🎬 호스트 컨트롤</h1>
          <p className="text-white/50 text-xs">우정의 온도 — 주최자 전용</p>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ background: bgColor, color: "#fff" }}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* 이탈 안내 (ABORTED 전용 화면이 아닐 때만) */}
      {earlyLeaveNames.length > 0 && status !== "ABORTED" && (
        <div className="mx-5 mt-4 rounded-2xl p-4 flex items-start justify-between gap-3"
          style={{ background: "#ef444422", border: "2px solid #ef4444" }}>
          <div>
            <p className="text-white font-black text-base">⚠️ 게임이 중단됐습니다</p>
            <p className="text-white/60 text-sm mt-0.5">
              {earlyLeaveNames.join(", ")}님이 게임 도중 이탈했습니다.
            </p>
          </div>
          <button onClick={() => setEarlyLeaveNames([])}
            className="text-white/40 text-lg shrink-0">✕</button>
        </div>
      )}

      {/* ABORTED: 다른 조작 불가, 리셋으로만 복구 */}
      {status === "ABORTED" && (
        <div
          className="mx-5 mt-4 rounded-2xl p-6 flex flex-col items-center gap-4 text-center"
          style={{ background: "#ef444422", border: "2px solid #ef4444" }}
        >
          <div>
            <p className="text-white font-black text-lg">게임이 중단됐습니다</p>
            {earlyLeaveNames.length > 0 && (
              <p className="text-white/60 text-sm mt-2">
                {earlyLeaveNames.join(", ")}님 연결이 끊겼어요 (새로고침·이탈)
              </p>
            )}
            <p className="text-white/40 text-xs mt-3">
              아래 버튼으로 초기화하면 참가자 화면도 함께 돌아갑니다. 카메라는 꺼진 상태입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="w-full max-w-sm py-4 rounded-xl font-black text-white text-lg active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #f97316, #dc2626)",
              boxShadow: "0 0 24px rgba(239,68,68,0.45)",
            }}
          >
            게임 리셋 · 처음부터
          </button>
        </div>
      )}

      {/* 3명 모임 알럿 */}
      {showStartAlert && status !== "ABORTED" && (
        <div className="mx-5 mt-4 rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: "#22c55e22", border: "2px solid #22c55e" }}>
          <div>
            <p className="text-white font-black text-base">🎉 3명이 모두 모였습니다!</p>
            <p className="text-white/60 text-sm mt-0.5">
              {Object.values(viewers).map(v => v.nickname).join(", ")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => { setShowStartAlert(false); await setStatus("PLAYING"); }}
              className="flex-1 py-3 rounded-xl font-bold text-white active:scale-95 transition-transform"
              style={{ background: "#22c55e", boxShadow: "0 0 20px #22c55e66" }}
            >
              🎮 지금 시작하기
            </button>
            <button
              onClick={() => setShowStartAlert(false)}
              className="px-4 py-3 rounded-xl font-bold text-white/50 active:scale-95 transition-transform"
              style={{ background: "#ffffff11" }}
            >
              나중에
            </button>
          </div>
        </div>
      )}

      <div
        className={`flex-1 flex flex-col gap-5 p-5 ${status === "ABORTED" ? "pointer-events-none opacity-30 select-none" : ""}`}
        aria-hidden={status === "ABORTED"}
      >

        {/* 친구 화면 미리보기 (PLAYING 이상일 때) */}
        {(status === "PLAYING" ||
          status === "CELEBRATION" ||
          status === "RANKING") && (
          <div className="bg-white/5 rounded-2xl p-5">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-4">현재 친구들 화면</p>
            <TemperatureGauge temperature={temperature} />
          </div>
        )}

        {/* 온도 컨트롤 */}
        <div className="bg-white/5 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">온도 조절</p>
            <span className="text-5xl font-black text-white tabular-nums">
              {(temperature ?? 0).toFixed(1)}°
            </span>
          </div>
          <input
            type="range" min={0} max={100} step={0.1} value={temperature}
            onChange={handleSlider}
            className="w-full h-3 rounded-full appearance-none cursor-pointer accent-orange-500"
            style={{ background: `linear-gradient(90deg, #f97316 ${temperature}%, #ffffff22 ${temperature}%)` }}
          />
          <div className="grid grid-cols-5 gap-2">
            {[-10, -1, -0.1, +1, +10].map((d) => (
              <button key={d} onClick={() => handleTempChange(d)}
                className="py-3 rounded-xl font-bold text-sm text-white transition-transform active:scale-95"
                style={{ background: d > 0 ? "#f9731633" : "#3b82f633", border: `1px solid ${d > 0 ? "#f97316" : "#3b82f6"}` }}>
                {d > 0 ? `+${d}` : `${d}`}
              </button>
            ))}
          </div>
        </div>

        {/* 게임 제어 */}
        <div className="bg-white/5 rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">게임 제어</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStatus("PLAYING")}
              disabled={status !== "WAITING" || Object.keys(viewers).length < 3}
              className="py-4 rounded-xl font-bold text-white disabled:opacity-40 active:scale-95 transition-transform flex flex-col items-center gap-0.5"
              style={{ background: "#22c55e33", border: "1px solid #22c55e" }}
            >
              <span>🎮 게임 시작</span>
              {Object.keys(viewers).length < 3 && (
                <span className="text-xs font-normal opacity-60">
                  {Object.keys(viewers).length}/3명 대기 중
                </span>
              )}
            </button>
            <button onClick={handleManualReveal} disabled={status === "WAITING"}
              className="py-4 rounded-xl font-bold text-white disabled:opacity-40 active:scale-95 transition-transform"
              style={{ background: "#ef444433", border: "1px solid #ef4444" }}>
              🎬 즉시 공개
            </button>
          </div>
          <button onClick={handleReset}
            className="py-3 rounded-xl font-bold text-white/60 text-sm active:scale-95 transition-transform"
            style={{ background: "#ffffff11", border: "1px solid #ffffff22" }}>
            ↩ 초기화 (처음부터)
          </button>
        </div>

        {/* 카메라 */}
        <div className="bg-white/5 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">카메라</p>
            <button onClick={cameraOn ? stopCamera : startCamera}
              className="px-4 py-2 rounded-full text-sm font-bold text-white active:scale-95 transition-transform"
              style={{ background: cameraOn ? "#ef444433" : "#22c55e33", border: `1px solid ${cameraOn ? "#ef4444" : "#22c55e"}` }}>
              {cameraOn ? "⏹ 끄기" : "▶ 켜기"}
            </button>
          </div>
          <div className="w-full aspect-video rounded-xl overflow-hidden flex items-center justify-center" style={{ background: "#000" }}>
            {cameraOn
              ? <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              : <p className="text-white/30 text-sm">카메라가 꺼져 있습니다</p>}
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl p-4">
          <p className="text-white/40 text-xs leading-relaxed">
            <span className="text-orange-400 font-bold">자동 시퀀스:</span>{" "}
            100도 도달 → 폭죽 3초 → 암전 1초 → 주최자 등장
          </p>
        </div>
      </div>
    </div>
  );
}
