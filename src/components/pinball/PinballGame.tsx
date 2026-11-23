"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/ukiki/TopBar";
import { CountdownView, GoBurst, NoGame, ReadyStyles, ReadyWaiting } from "@/components/ukiki/ReadyRoom";
import type { PinballState } from "@/lib/pinball/store";
import { countdownLeft, readyPhase, showGoBurst, waitLeftSeconds } from "@/lib/ukiki/ready";
import { requestNudge } from "@/lib/ukiki/nudge-client";
import PinballStage, { type PinballPlayer } from "./PinballStage";
import PinballResult from "./PinballResult";

const POLL_MS = 700;
/** 늦게 들어온 사람은 이 시간이 지났으면 바로 결과를 본다 */
const LATE_MS = 30_000;
const EMOJIS = ["🐵", "🐰", "🐻", "🦊", "🐱", "🐶", "🐼", "🐸", "🐯", "🐷", "🐨", "🐹"];
const COLORS = ["#ff2bd6", "#00f0ff", "#b6ff00", "#ffb800", "#a46bff", "#3d7bff", "#ff5a5a", "#2bffb1"];

// 랜덤 핀볼 실제 게임: 준비 → 3·2·1 → 같은 시드로 구슬 굴리기 → 오늘의 주인공
export default function PinballGame({ roomCode, gameId, me }: { roomCode: string; gameId: number; me: string }) {
  const [state, setState] = useState<PinballState | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const api = `/api/ukiki/rooms/${roomCode}/pinball/${gameId}`;

  const load = useCallback(async () => {
    const res = await fetch(api, { cache: "no-store" }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; state?: PinballState } | null) : null;
    if (data?.ok && data.state) {
      setState(data.state);
      setOffset(new Date(data.state.serverNow).getTime() - Date.now());
    }
  }, [api]);

  const started = !!state?.startedAt;
  useEffect(() => {
    void load();
    if (started) return; // 시작하면 더 불러올 게 없다
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load, started]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(t);
  }, []);

  // 구슬 주인들 (입장 순서대로 이모지·색). 폴링으로 state 가 바뀌어도 판이 다시 시작되지 않게 고정
  const membersKey = state ? JSON.stringify([state.members, state.players.map((p) => p.name)]) : "";
  const balls: PinballPlayer[] = useMemo(() => {
    if (!state) return [];
    return state.members.map((id, i) => ({
      id,
      name: state.players.find((p) => p.id === id)?.name ?? "친구",
      emoji: EMOJIS[i % EMOJIS.length],
      color: COLORS[i % COLORS.length],
    }));
  }, [membersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <div style={{ position: "absolute", inset: 0, background: "#04030a" }} />;

  const serverNow = now + offset;
  const startedMs = state.startedAt ? new Date(state.startedAt).getTime() : null;
  const rp = readyPhase(startedMs, serverNow);
  const showResult = rp === "STARTED" && (finished || (startedMs !== null && serverNow - startedMs > LATE_MS));
  const myReady = state.players.find((p) => p.id === me)?.ready === true;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", color: "#fff", fontFamily: "sans-serif", background: "#04030a", userSelect: "none" }}>
      <ReadyStyles />
      <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <TopBar
          backHref={`/r/${roomCode}`}
          title="🎱 랜덤 핀볼"
          sub={<p style={{ fontSize: 12, opacity: 0.6 }}>👥 {(state.members.length || state.players.length)}명 참여</p>}
        />
        {rp === "WAITING" && state.cancelled && <NoGame emoji="🎱" backHref={`/r/${roomCode}`} />}
        {rp === "WAITING" && !state.cancelled && (
          <ReadyWaiting
            wait={{ leftSeconds: waitLeftSeconds(state.waitUntil ? new Date(state.waitUntil).getTime() : null, serverNow), roomSize: state.roomSize }}
            players={state.players}
            meId={me}
            emoji="🎱"
            waitingFor="친구가 들어오길 기다리는 중"
            onReady={async () => {
              await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ready", ready: !myReady }) }).catch(() => null);
              await load();
            }}
            onNudge={() => requestNudge(roomCode, gameId)}
          />
        )}
        {rp === "COUNTDOWN" && <CountdownView count={countdownLeft(startedMs, serverNow)} hint="🎱 1등이 오늘의 주인공!" />}
        {rp === "STARTED" && state.seed !== null && (
          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
            {showResult ? (
              <PinballResult players={balls} order={state.order} backHref={`/r/${roomCode}`} />
            ) : (
              <>
                <PinballStage players={balls} meId={me} seed={state.seed} startedAtMs={startedMs === null ? null : startedMs - offset} onDone={() => setFinished(true)} />
                {showGoBurst(startedMs, serverNow) && <GoBurst label="출발! 🎱" />}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
