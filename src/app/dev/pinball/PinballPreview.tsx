"use client";

import { useEffect, useMemo, useState } from "react";
import PinballStage, { type PinballPlayer } from "@/components/pinball/PinballStage";
import PinballResult from "@/components/pinball/PinballResult";
import { CountdownView, GoBurst, ReadyStyles } from "@/components/ukiki/ReadyRoom";
import { simulateOrder } from "@/lib/pinball/logic";
import { countdownLeft, COUNTDOWN_MS, readyPhase, showGoBurst } from "@/lib/ukiki/ready";

// 랜덤 핀볼 로컬 미리보기: 3·2·1 → 구슬 굴리기(결승 직전 확대 슬로모션) → 오늘의 주인공
const ALL: PinballPlayer[] = [
  { id: "me", name: "소현", emoji: "🐵", color: "#ffb800" },
  { id: "f1", name: "우정", emoji: "🐰", color: "#ff2bd6" },
  { id: "f2", name: "민지", emoji: "🐻", color: "#a46bff" },
  { id: "f3", name: "지훈", emoji: "🦊", color: "#00f0ff" },
  { id: "f4", name: "하린", emoji: "🐱", color: "#3d7bff" },
  { id: "f5", name: "도윤", emoji: "🐶", color: "#b6ff00" },
];

const chip = (on: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid rgba(255,255,255,.2)",
  background: on ? "#FEE500" : "transparent",
  color: on ? "#191919" : "#fff",
  cursor: "pointer",
});

export default function PinballPreview() {
  const [count, setCount] = useState(5);
  const [seed, setSeed] = useState(1);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const players = useMemo(() => ALL.slice(0, count), [count]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  // win: "me" = 내가 1등인 판, "other" = 남이 1등인 판, 없으면 아무 판
  function play(win?: "me" | "other") {
    let sd = Math.floor(Math.random() * 1e9);
    if (win) {
      const ids = players.map((p) => p.id);
      while ((simulateOrder(ids, sd)[0] === "me") !== (win === "me")) sd++;
    }
    setOrder(null);
    setSeed(sd);
    setStartedAt(Date.now() + COUNTDOWN_MS);
  }

  const rp = readyPhase(startedAt, now);

  return (
    <main style={{ minHeight: "100dvh", background: "#050505", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 12 }}>
      <ReadyStyles />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => play()} style={{ ...chip(false), background: "#e03000", color: "#fff" }}>
          ▶ 처음부터 재생
        </button>
        <button onClick={() => play("me")} style={chip(false)}>
          👑 내가 1등인 판
        </button>
        <button onClick={() => play("other")} style={chip(false)}>
          🫥 남이 1등인 판
        </button>
        {[2, 3, 4, 5, 6].map((n) => (
          <button key={n} onClick={() => setCount(n)} style={chip(n === count)}>
            {n}명
          </button>
        ))}
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: 420, height: "min(78dvh, 720px)" }}>
        {startedAt === null ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", textAlign: "center", opacity: 0.8 }}>
            🎱 랜덤 핀볼
            <br />
            1등이 오늘의 주인공!
          </div>
        ) : rp === "COUNTDOWN" ? (
          <CountdownView count={countdownLeft(startedAt, now)} hint="구슬이 곧 떨어져요" />
        ) : order ? (
          <PinballResult players={players} order={order} />
        ) : (
          <>
            <PinballStage players={players} meId="me" seed={seed} onDone={setOrder} />
            {showGoBurst(startedAt, now) && <GoBurst label="출발! 🎱" />}
          </>
        )}
      </div>
    </main>
  );
}
