"use client";

import { useEffect, useState } from "react";
import SnackStage, { type SnackPhase } from "@/components/snack/SnackStage";
import { judgeSnack } from "@/lib/snack/logic";
import { countdownLeft, COUNTDOWN_MS, readyPhase, showGoBurst } from "@/lib/ukiki/ready";

// 과자 나눠먹기 로컬 미리보기: 가짜 친구 둘이 1초 뒤 준비하고, 시작 2초 뒤 아무 양이나 자른다.
const ME = "me";
const NAMES: Record<string, string> = { me: "소현", f1: "우정", f2: "민지" };
const IDS = ["me", "f1", "f2"];

type Sim = { ready: Record<string, boolean>; startedAt: number | null; cuts: Record<string, number | null>; greedy: boolean };
const fresh = (greedy = false): Sim => ({ ready: { me: false, f1: false, f2: false }, startedAt: null, cuts: { me: null, f1: null, f2: null }, greedy });

const tab: React.CSSProperties = { padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,.2)", background: "transparent", color: "#fff", cursor: "pointer" };

export default function SnackPreview() {
  const [sim, setSim] = useState<Sim>(() => fresh());
  const [now, setNow] = useState(() => Date.now());
  const [key, setKey] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const rp = readyPhase(sim.startedAt, now);
  useEffect(() => {
    if (rp !== "WAITING") return;
    const t = setTimeout(() => setSim((s) => ({ ...s, ready: { ...s.ready, f1: true, f2: true } })), 1000);
    return () => clearTimeout(t);
  }, [rp, key]);
  useEffect(() => {
    if (sim.startedAt === null && Object.values(sim.ready).every(Boolean)) setSim((s) => ({ ...s, startedAt: Date.now() + COUNTDOWN_MS }));
  }, [sim]);
  useEffect(() => {
    if (rp !== "STARTED") return;
    const t = setTimeout(
      () => setSim((s) => ({ ...s, cuts: { ...s.cuts, f1: s.greedy ? 45 : 28, f2: s.greedy ? 40 : 31 } })),
      2000,
    );
    return () => clearTimeout(t);
  }, [rp, key]);

  const result = judgeSnack(IDS.map((id) => sim.cuts[id]));
  const phase: SnackPhase = result ? "RESULT" : rp === "WAITING" ? "WAITING" : rp === "COUNTDOWN" ? "COUNTDOWN" : sim.cuts.me === null ? "CUTTING" : "DONE";

  const restart = (greedy: boolean) => {
    setSim(fresh(greedy));
    setKey((k) => k + 1);
  };

  return (
    <main style={{ minHeight: "100dvh", background: "#050505", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => restart(false)} style={{ ...tab, background: "#e03000" }}>
          ▶ 처음부터 (친구들 적게)
        </button>
        <button onClick={() => restart(true)} style={tab}>
          ▶ 처음부터 (친구들 욕심)
        </button>
      </div>
      <div style={{ position: "relative", width: 390, maxWidth: "100%", height: 780, borderRadius: 28, overflow: "hidden", background: "#0a0a0a", border: "1px solid rgba(255,255,255,.12)", transform: "translateZ(0)" }}>
        <SnackStage
          key={key}
          backHref="/dev/snack"
          phase={phase}
          players={IDS.map((id) => ({ id, name: NAMES[id], ready: sim.ready[id], done: sim.cuts[id] !== null, cut: result ? sim.cuts[id] : null }))}
          meId={ME}
          count={countdownLeft(sim.startedAt, now)}
          showGo={showGoBurst(sim.startedAt, now)}
          myCut={sim.cuts.me}
          total={result?.total ?? null}
          failed={result?.status === "fail"}
          spectator={false}
          onReady={() => setSim((s) => ({ ...s, ready: { ...s.ready, me: !s.ready.me } }))}
          onCut={(a) => setSim((s) => ({ ...s, cuts: { ...s.cuts, me: a } }))}
          onNudge={async () => "📣 2명에게 재촉했어요!"}
        />
      </div>
    </main>
  );
}
