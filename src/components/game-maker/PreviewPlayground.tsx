"use client";

import { useCallback, useEffect, useState } from "react";
import { CountdownView, GoBurst, ReadyStyles } from "@/components/ukiki/ReadyRoom";
import { primaryButton } from "@/components/ukiki/styles";
import type { KitEndResult, KitEvent, KitMessage, KitPlayer } from "@/lib/game-maker/kit";
import { normalizeEnd, winnersFromScores } from "@/lib/game-maker/round";
import GameFrame from "./GameFrame";
import AiResult from "./AiResult";

// 미리 해 보기: 실제 방과 똑같이 3·2·1 → 시작! → 결과 순서로, 나와 '연습 친구' 두 명이 같은 게임을 돌린다.
// 두 화면은 이 기기 안에서 메시지를 주고받는다 (서버·바나나 없음). 위 탭으로 누구 화면을 볼지 고른다.
const PLAYERS: KitPlayer[] = [
  { id: "me", name: "나", emoji: "🐵" },
  { id: "friend", name: "연습 친구", emoji: "🐰" },
];

type Phase = "idle" | "countdown" | "playing" | "done";

export default function PreviewPlayground({ html, title, emoji, autoStart = false }: { html: string; title: string; emoji: string; autoStart?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState(0);
  const [seed, setSeed] = useState(1);
  const [view, setView] = useState("me");
  const [events, setEvents] = useState<KitEvent[]>([]);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [result, setResult] = useState<KitEndResult | null>(null);
  const [count, setCount] = useState(3);
  const [goAt, setGoAt] = useState(0);
  const [now, setNow] = useState(0);

  const start = () => {
    setRun((r) => r + 1);
    setSeed(Math.floor(Math.random() * 2147483647));
    setEvents([]);
    setScores({});
    setResult(null);
    setView("me");
    setCount(3);
    setPhase("countdown");
  };

  // 버전이 바뀌면 처음으로
  useEffect(() => setPhase("idle"), [html]);
  // 팝업으로 열면 바로 3·2·1
  useEffect(() => {
    if (autoStart) start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      setGoAt(Date.now());
      setPhase("playing");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(t);
  }, [phase]);

  const onKit = useCallback(
    (from: string) => (m: Exclude<KitMessage, { type: "ready" }>) => {
      if (m.type === "send") {
        // 실제처럼 조금 늦게 모두에게
        setTimeout(() => setEvents((prev) => [...prev, { from, data: m.data, seq: prev.length + 1 }]), 300);
      } else if (m.type === "score") {
        setScores((prev) => ({ ...prev, [from]: m.value }));
      } else if (m.type === "end") {
        setResult((r) => r ?? normalizeEnd(m.result, PLAYERS.map((p) => p.id)));
      }
    },
    [],
  );

  // 둘 다 점수를 내면 최고점이 1등
  useEffect(() => {
    const winners = winnersFromScores(scores, PLAYERS.map((p) => p.id));
    if (winners) setResult((r) => r ?? { winners, teamSuccess: false });
  }, [scores]);

  useEffect(() => {
    if (result && phase === "playing") {
      const t = setTimeout(() => setPhase("done"), 400);
      return () => clearTimeout(t);
    }
  }, [result, phase]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      <ReadyStyles />
      {phase === "playing" && (
        <div style={{ display: "flex", gap: 6 }}>
          {PLAYERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setView(p.id)}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                border: view === p.id ? "1px solid #ffd84d" : "1px solid rgba(255,255,255,.15)",
                background: view === p.id ? "rgba(255,216,77,.15)" : "transparent",
                color: "#fff",
              }}
            >
              {p.emoji} {p.name} 화면{scores[p.id] !== undefined && scores[p.id] !== null ? ` · ${scores[p.id]}점` : ""}
            </button>
          ))}
        </div>
      )}
      <div style={{ position: "relative", flex: 1, minHeight: 0, borderRadius: 16, overflow: "hidden", background: "#0d0d14", border: "1px solid rgba(255,255,255,.1)" }}>
        {phase === "idle" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, textAlign: "center" }}>
            <p style={{ fontSize: 48 }}>{emoji}</p>
            <p style={{ fontWeight: 800 }}>{title}</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>실제 방처럼 3·2·1 뒤에 시작해요. 나와 연습 친구 두 명이 같이 해요.</p>
            <button onClick={start} style={{ ...primaryButton, width: "100%", maxWidth: 260 }}>
              ▶ 미리 해 보기
            </button>
          </div>
        )}
        {phase === "countdown" && (
          <div style={{ position: "absolute", inset: 0, display: "flex" }}>
            <CountdownView count={count} hint={`${emoji} ${title}`} />
          </div>
        )}
        {phase === "playing" &&
          PLAYERS.map((p) => (
            <div
              key={`${run}-${p.id}`}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: view === p.id ? 2 : 1,
                opacity: view === p.id ? 1 : 0,
                visibility: view === p.id ? "visible" : "hidden",
                pointerEvents: view === p.id ? "auto" : "none",
              }}
            >
              <GameFrame html={html} boot={{ mode: "preview", me: p.id, players: PLAYERS, seed }} events={events} onMessage={onKit(p.id)} />
            </div>
          ))}
        {phase === "playing" && now - goAt < 900 && <GoBurst />}
        {phase === "done" && result && (
          <div style={{ position: "absolute", inset: 0 }}>
            <AiResult title={title} emoji={emoji} players={PLAYERS} result={result} me="me" onRestart={start} showBananas={false} />
          </div>
        )}
      </div>
    </div>
  );
}
