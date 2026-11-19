"use client";

import { useEffect, useRef, useState } from "react";
import FanfareStage, { type StagePlayer } from "@/components/fanfare/FanfareStage";
import {
  applyTap,
  countdownNumber,
  COUNTDOWN_MS,
  derivePhase,
  effectiveTemperature,
  initialState,
  startState,
  type FanfarePhase,
  type FanfareState,
} from "@/lib/fanfare/logic";
import { playBeep, playFanfare, resumeAudio } from "@/lib/sounds";

// 빵빠레 화면을 상태별로 보는 로컬 미리보기. Firebase·로그인 없이 가짜 친구로 돌린다.
const ME = "me";
const FRIENDS: StagePlayer[] = [
  { id: ME, name: "소현", ready: false },
  { id: "f1", name: "우정", ready: false },
  { id: "f2", name: "민지", ready: false },
];
const TAPS = { [ME]: 42, f1: 57, f2: 31 };

type Story = {
  label: string;
  phase: FanfarePhase;
  temperature?: number;
  count?: number;
  showGo?: boolean;
  players: StagePlayer[];
};

const ready = (ids: string[]) => FRIENDS.map((p) => ({ ...p, ready: ids.includes(p.id) }));

const STORIES: Story[] = [
  { label: "혼자 (2명부터)", phase: "WAITING", players: [FRIENDS[0]] },
  { label: "대기", phase: "WAITING", players: ready([]) },
  { label: "나만 준비", phase: "WAITING", players: ready([ME]) },
  { label: "모두 준비", phase: "WAITING", players: ready([ME, "f1", "f2"]) },
  { label: "3", phase: "COUNTDOWN", count: 3, players: ready([ME, "f1", "f2"]) },
  { label: "2", phase: "COUNTDOWN", count: 2, players: ready([ME, "f1", "f2"]) },
  { label: "1", phase: "COUNTDOWN", count: 1, players: ready([ME, "f1", "f2"]) },
  { label: "시작!", phase: "PLAYING", temperature: 0, showGo: true, players: FRIENDS },
  { label: "진행 40°", phase: "PLAYING", temperature: 40, players: FRIENDS },
  { label: "진행 95°", phase: "PLAYING", temperature: 95, players: FRIENDS },
  { label: "100° 폭죽", phase: "CELEBRATION", temperature: 100, players: FRIENDS },
  { label: "순위", phase: "RANKING", temperature: 100, players: FRIENDS },
];

const tabStyle = (on: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid rgba(255,255,255,.2)",
  background: on ? "#FEE500" : "transparent",
  color: on ? "#191919" : "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export default function FanfarePreview() {
  const [storyIdx, setStoryIdx] = useState<number | null>(1);
  const [replayKey, setReplayKey] = useState(0);

  // ── 처음부터 재생: 실제 규칙(logic.ts)으로 돌린다. 친구들은 알아서 준비하고 탭한다. ──
  const [sim, setSim] = useState<{ state: FanfareState; players: StagePlayer[]; taps: Record<string, number> } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tapFlash, setTapFlash] = useState(false);
  const simRef = useRef(sim);
  simRef.current = sim;

  useEffect(() => {
    if (!sim) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [sim]);

  const simPhase = sim ? derivePhase(sim.state, now, { reveal: false }).phase : null;

  // 친구들: 1초 뒤 준비, 진행 중엔 0.25초마다 탭
  useEffect(() => {
    if (!sim) return;
    if (simPhase === "WAITING") {
      const t = setTimeout(() => setSim((s) => s && { ...s, players: s.players.map((p) => (p.id === ME ? p : { ...p, ready: true })) }), 1000);
      return () => clearTimeout(t);
    }
    if (simPhase === "PLAYING") {
      const t = setInterval(() => {
        setSim((s) => {
          if (!s) return s;
          const who = Math.random() < 0.5 ? "f1" : "f2";
          const next = applyTap(s.state, Date.now(), 3);
          return next === s.state ? s : { ...s, state: next, taps: { ...s.taps, [who]: (s.taps[who] ?? 0) + 1 } };
        });
      }, 250);
      return () => clearInterval(t);
    }
  }, [simPhase, sim === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // 모두 준비되면 3·2·1
  useEffect(() => {
    if (!sim || simPhase !== "WAITING") return;
    if (sim.players.every((p) => p.ready)) setSim({ ...sim, state: startState(sim.state, Date.now(), COUNTDOWN_MS) });
  }, [sim, simPhase]);

  // 효과음
  const beepRef = useRef(-1);
  const count = sim ? countdownNumber(sim.state, now) : 0;
  useEffect(() => {
    if (simPhase === "COUNTDOWN" && count > 0 && beepRef.current !== count) {
      beepRef.current = count;
      playBeep();
    }
    if (simPhase === "PLAYING" && beepRef.current > 0) {
      beepRef.current = 0;
      playBeep(true);
    }
    if (simPhase === "CELEBRATION" && beepRef.current === 0) {
      beepRef.current = -2;
      playFanfare();
    }
  }, [simPhase, count]);

  const play = async () => {
    await resumeAudio().catch(() => {});
    beepRef.current = -1;
    setStoryIdx(null);
    setSim({ state: initialState(), players: ready([]), taps: {} });
  };

  const myTap = () => {
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
    setSim((s) => {
      if (!s) return s;
      const next = applyTap(s.state, Date.now(), 3);
      return next === s.state ? s : { ...s, state: next, taps: { ...s.taps, [ME]: (s.taps[ME] ?? 0) + 1 } };
    });
  };

  const story = storyIdx !== null ? STORIES[storyIdx] : null;
  const stage = sim && !story ? (
    <FanfareStage
      backHref="/dev/fanfare"
      phase={simPhase ?? "WAITING"}
      temperature={effectiveTemperature(sim.state, now)}
      count={count}
      showGo={simPhase === "PLAYING" && sim.state.startedAt !== null && now - sim.state.startedAt < 900}
      players={sim.players}
      taps={sim.taps}
      meId={ME}
      tapFlash={tapFlash}
      onReady={() => setSim((s) => s && { ...s, players: s.players.map((p) => (p.id === ME ? { ...p, ready: !p.ready } : p)) })}
      onClose={() => setSim(null)}
      onTap={myTap}
    />
  ) : story ? (
    <FanfareStage
      key={`${storyIdx}-${replayKey}`}
      backHref="/dev/fanfare"
      phase={story.phase}
      temperature={story.temperature ?? 0}
      count={story.count ?? 0}
      showGo={story.showGo ?? false}
      players={story.players}
      taps={TAPS}
      meId={ME}
      tapFlash={false}
      onReady={() => {}}
      onClose={() => {}}
      onTap={() => {}}
    />
  ) : null;

  return (
    <main style={{ minHeight: "100dvh", background: "#050505", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 720 }}>
        <button onClick={play} style={{ ...tabStyle(storyIdx === null), background: storyIdx === null ? "#FEE500" : "#e03000", color: storyIdx === null ? "#191919" : "#fff" }}>
          ▶ 처음부터 재생
        </button>
        {STORIES.map((s, i) => (
          <button
            key={s.label}
            onClick={() => {
              setSim(null);
              setStoryIdx(i);
              setReplayKey((k) => k + 1);
            }}
            style={tabStyle(storyIdx === i)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ position: "relative", width: 390, maxWidth: "100%", height: 780, borderRadius: 28, overflow: "hidden", background: "#0a0a0a", border: "1px solid rgba(255,255,255,.12)", transform: "translateZ(0)" }}>
        {stage}
      </div>
    </main>
  );
}
