"use client";

import type { PinballPlayer } from "./PinballStage";

const CSS = `
@keyframes pb-rays { to { transform: rotate(360deg); } }
@keyframes pb-pop { 0% { transform: scale(.2); opacity: 0 } 60% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1) } }
@keyframes pb-crown { 0%,100% { transform: translateY(0) rotate(-8deg) } 50% { transform: translateY(-8px) rotate(8deg) } }
@keyframes pb-up { from { transform: translateY(16px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes pb-fall { to { transform: translateY(110vh) rotate(720deg) } }
`;

const CONFETTI = ["#ff2bd6", "#00f0ff", "#b6ff00", "#ffb800", "#a46bff"];

// 결과: 1등은 "오늘의 주인공"으로 크게, 나머지는 순서대로.
export default function PinballResult({ players, order }: { players: PinballPlayer[]; order: string[] }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const star = byId.get(order[0])!;
  const rest = order.slice(1).map((id) => byId.get(id)!);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: 16, background: "radial-gradient(circle at 50% 25%, #2a0b3d, #04030a 70%)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{CSS}</style>

      {/* 빛줄기 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -180,
          width: 640,
          height: 640,
          background: "repeating-conic-gradient(rgba(255,43,214,.16) 0 10deg, rgba(0,240,255,.12) 10deg 20deg, transparent 20deg 30deg)",
          borderRadius: "50%",
          animation: "pb-rays 14s linear infinite",
        }}
      />
      {/* 꽃가루 */}
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            top: -20,
            left: `${(i * 37) % 100}%`,
            width: 7,
            height: 12,
            background: CONFETTI[i % CONFETTI.length],
            animation: `pb-fall ${2.4 + (i % 5) * 0.5}s ${(i % 7) * 0.3}s linear infinite`,
          }}
        />
      ))}

      <div style={{ position: "relative", marginTop: 44, fontSize: 15, fontWeight: 800, color: "#ffd6f6", letterSpacing: 2, textShadow: "0 0 8px #ff2bd6, 0 0 18px #ff2bd6" }}>✨ 오늘의 주인공 ✨</div>
      <div style={{ position: "relative", marginTop: 52, animation: "pb-pop .7s ease-out both" }}>
        <div style={{ position: "absolute", top: -40, left: "50%", marginLeft: -22, fontSize: 44, animation: "pb-crown 1.4s ease-in-out infinite" }}>👑</div>
        <div
          style={{
            width: 130,
            height: 130,
            borderRadius: "50%",
            background: "#0a0614",
            border: `5px solid ${star.color}`,
            boxShadow: `0 0 20px ${star.color}, 0 0 60px ${star.color}, inset 0 0 24px ${star.color}`,
            display: "grid",
            placeItems: "center",
            fontSize: 70,
          }}
        >
          {star.emoji}
        </div>
      </div>
      <div style={{ position: "relative", marginTop: 18, fontSize: 32, fontWeight: 900, textShadow: `0 0 10px ${star.color}, 0 0 24px ${star.color}`, animation: "pb-up .5s .4s both" }}>{star.name}</div>
      <div style={{ position: "relative", marginTop: 4, fontSize: 14, opacity: 0.75, animation: "pb-up .5s .5s both" }}>1등으로 골인! 🎉</div>

      <div style={{ position: "relative", marginTop: 28, width: "100%", maxWidth: 320, padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {rest.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(10,6,20,.7)",
              border: `1px solid ${p.color}`,
              boxShadow: `0 0 10px ${p.color}55`,
              animation: `pb-up .4s ${0.8 + i * 0.12}s both`,
            }}
          >
            <span style={{ width: 28, fontWeight: 800, opacity: 0.6 }}>{i + 2}위</span>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#0a0614", border: `2px solid ${p.color}`, boxShadow: `0 0 8px ${p.color}`, display: "grid", placeItems: "center", fontSize: 16 }}>{p.emoji}</span>
            <span style={{ fontWeight: 700 }}>{p.name}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
