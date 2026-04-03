"use client";

import { useEffect, useRef } from "react";

interface Props {
  temperature: number; // 0 ~ 100
}

// 온도 단계별 주전자 상태
function getKettleState(t: number): {
  emoji: string;
  label: string;
  steamCount: number;
  glowColor: string;
  kettleColor: string;
} {
  if (t < 10)  return { emoji: "🧊", label: "꽁꽁 얼음",   steamCount: 0, glowColor: "#93c5fd", kettleColor: "#bfdbfe" };
  if (t < 30)  return { emoji: "🫖", label: "차가운 물",   steamCount: 0, glowColor: "#60a5fa", kettleColor: "#93c5fd" };
  if (t < 50)  return { emoji: "🫖", label: "미지근함",    steamCount: 1, glowColor: "#34d399", kettleColor: "#6ee7b7" };
  if (t < 70)  return { emoji: "🫖", label: "따뜻해지는 중", steamCount: 2, glowColor: "#fbbf24", kettleColor: "#fde68a" };
  if (t < 90)  return { emoji: "🫖", label: "점점 뜨거워짐", steamCount: 3, glowColor: "#f97316", kettleColor: "#fdba74" };
  if (t < 100) return { emoji: "🫖", label: "끓기 직전!",  steamCount: 4, glowColor: "#ef4444", kettleColor: "#fca5a5" };
  return        { emoji: "♨️", label: "펄펄 끓는 중! 🔥",  steamCount: 5, glowColor: "#ff0000", kettleColor: "#ff6060" };
}

function SteamPuff({ delay, x }: { delay: number; x: number }) {
  return (
    <div
      className="absolute bottom-0 rounded-full"
      style={{
        left: `${x}%`,
        width: 10,
        height: 10,
        background: "rgba(255,255,255,0.6)",
        animation: `steam-rise 1.4s ${delay}s ease-out infinite`,
      }}
    />
  );
}

export default function TemperatureGauge({ temperature }: Props) {
  const t = Math.min(100, Math.max(0, temperature ?? 0));
  const pct = t;
  const state = getKettleState(t);
  const isBoiling = t >= 100;

  return (
    <>
      {/* 스팀 CSS 키프레임 */}
      <style>{`
        @keyframes steam-rise {
          0%   { transform: translateY(0) scale(1);   opacity: 0.7; }
          60%  { transform: translateY(-40px) scale(1.8); opacity: 0.3; }
          100% { transform: translateY(-70px) scale(2.5); opacity: 0; }
        }
        @keyframes kettle-shake {
          0%, 100% { transform: rotate(0deg); }
          25%  { transform: rotate(-3deg); }
          75%  { transform: rotate(3deg); }
        }
      `}</style>

      <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto select-none">
        {/* 주전자 이모지 + 스팀 */}
        <div className="relative flex flex-col items-center">
          {/* 스팀 컨테이너 */}
          <div className="relative h-16 w-24 mb-1 overflow-hidden">
            {state.steamCount >= 1 && <SteamPuff delay={0}    x={50} />}
            {state.steamCount >= 2 && <SteamPuff delay={0.4}  x={30} />}
            {state.steamCount >= 3 && <SteamPuff delay={0.2}  x={65} />}
            {state.steamCount >= 4 && <SteamPuff delay={0.6}  x={20} />}
            {state.steamCount >= 5 && <SteamPuff delay={0.1}  x={75} />}
          </div>

          {/* 주전자 */}
          <div
            style={{
              fontSize: 80,
              filter: `drop-shadow(0 0 ${Math.floor(t / 10) * 3}px ${state.glowColor})`,
              animation: isBoiling ? "kettle-shake 0.3s ease-in-out infinite" : "none",
              transition: "filter 0.5s",
            }}
          >
            {state.emoji}
          </div>
        </div>

        {/* 온도 숫자 */}
        <div
          className="text-6xl font-black tabular-nums tracking-tight transition-colors duration-700"
          style={{ color: state.glowColor, textShadow: `0 0 30px ${state.glowColor}66` }}
        >
          {t.toFixed(1)}<span className="text-3xl align-top mt-2 ml-0.5">°</span>
        </div>

        {/* 게이지 바 */}
        <div className="w-full">
          <div className="w-full h-4 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, #93c5fd, ${state.glowColor})`,
                boxShadow: `0 0 10px ${state.glowColor}88`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-white/30 font-mono">
            <span>🧊</span><span>25°</span><span>50°</span><span>75°</span><span>♨️</span>
          </div>
        </div>

        {/* 상태 라벨 */}
        <p
          className="text-base font-bold transition-all duration-500"
          style={{ color: state.glowColor, textShadow: `0 0 15px ${state.glowColor}88` }}
        >
          {state.label}
        </p>
      </div>
    </>
  );
}
