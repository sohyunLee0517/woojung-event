"use client";

import { useEffect, useState } from "react";
import PirateStage, { type PiratePhase } from "@/components/pirate/PirateStage";
import { HOLES, judgeStab, pickTrap, turnOf } from "@/lib/pirate/logic";
import { countdownLeft, COUNTDOWN_MS, readyPhase, showGoBurst } from "@/lib/ukiki/ready";

// 해적 무찌르기 로컬 미리보기: 실제 규칙(logic.ts)으로 가짜 친구 둘과 돌아가며 꽂는다.
const ME = "me";
const NAMES: Record<string, string> = { me: "소현", f1: "우정", f2: "민지" };
const ORDER = ["me", "f1", "f2"];

type Sim = { ready: Record<string, boolean>; startedAt: number | null; trap: number; stabs: number[]; status: "playing" | "fail" | "success" };
const fresh = (): Sim => ({ ready: { me: false, f1: false, f2: false }, startedAt: null, trap: pickTrap(), stabs: [], status: "playing" });

const tab = (on: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid rgba(255,255,255,.2)",
  background: on ? "#FEE500" : "transparent",
  color: on ? "#191919" : "#fff",
  cursor: "pointer",
});

export default function PiratePreview() {
  const [sim, setSim] = useState<Sim>(fresh);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const rp = readyPhase(sim.startedAt, now);
  const turn = rp === "STARTED" && sim.status === "playing" ? turnOf(ORDER, sim.stabs.length) : null;

  // 친구들: 0.6초 뒤 준비, 자기 차례면 1초 뒤 아무 구멍에 꽂는다
  useEffect(() => {
    if (rp === "WAITING") {
      const t = setTimeout(() => setSim((s) => ({ ...s, ready: { ...s.ready, f1: true, f2: true } })), 600);
      return () => clearTimeout(t);
    }
  }, [rp]);
  useEffect(() => {
    if (sim.startedAt === null && Object.values(sim.ready).every(Boolean)) setSim((s) => ({ ...s, startedAt: Date.now() + COUNTDOWN_MS }));
  }, [sim]);
  useEffect(() => {
    if (!turn || turn === ME) return;
    const t = setTimeout(() => {
      const free = [...Array(HOLES).keys()].filter((h) => !sim.stabs.includes(h));
      stabHole(free[Math.floor(Math.random() * free.length)]);
    }, 1000);
    return () => clearTimeout(t);
  }, [turn, sim.stabs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function stabHole(hole: number) {
    setSim((s) => {
      if (s.status !== "playing" || s.stabs.includes(hole)) return s;
      const outcome = judgeStab({ hole, trap: s.trap, stabbedBefore: s.stabs.length });
      return { ...s, stabs: [...s.stabs, hole], status: outcome === "continue" ? "playing" : outcome };
    });
  }

  const phase: PiratePhase =
    sim.status === "fail" ? "FAIL" : sim.status === "success" ? "SUCCESS" : rp === "WAITING" ? "WAITING" : rp === "COUNTDOWN" ? "COUNTDOWN" : "PLAYING";

  const jump = (p: "playing" | "fail" | "success") => {
    const base = { ...fresh(), ready: { me: true, f1: true, f2: true }, startedAt: Date.now() - 5000 };
    if (p === "playing") setSim(base);
    if (p === "fail") setSim({ ...base, stabs: [1, 2, base.trap], status: "fail" });
    if (p === "success") setSim({ ...base, stabs: [...Array(HOLES).keys()].filter((h) => h !== base.trap), status: "success" });
  };

  return (
    <main style={{ minHeight: "100dvh", background: "#050505", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => setSim(fresh())} style={{ ...tab(false), background: "#e03000", color: "#fff" }}>
          ▶ 처음부터 재생
        </button>
        <button onClick={() => jump("playing")} style={tab(false)}>
          바로 게임
        </button>
        <button onClick={() => jump("fail")} style={tab(false)}>
          실패 화면
        </button>
        <button onClick={() => jump("success")} style={tab(false)}>
          성공 화면
        </button>
      </div>
      <div style={{ position: "relative", width: 390, maxWidth: "100%", height: 780, borderRadius: 28, overflow: "hidden", background: "#0a0a0a", border: "1px solid rgba(255,255,255,.12)", transform: "translateZ(0)" }}>
        <PirateStage
          key={sim.trap + ":" + (sim.startedAt ?? 0)}
          backHref="/dev/pirate"
          phase={phase}
          players={ORDER.map((id) => ({ id, name: NAMES[id], ready: sim.ready[id] }))}
          meId={ME}
          count={countdownLeft(sim.startedAt, now)}
          showGo={showGoBurst(sim.startedAt, now) && sim.status === "playing"}
          turnName={turn ? NAMES[turn] : null}
          myTurn={turn === ME}
          stabs={sim.stabs}
          onReady={() => setSim((s) => ({ ...s, ready: { ...s.ready, me: !s.ready.me } }))}
          onStab={stabHole}
          onNudge={async () => "📣 2명에게 재촉했어요!"}
        />
      </div>
    </main>
  );
}
