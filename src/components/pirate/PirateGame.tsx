"use client";

import { useCallback, useEffect, useState } from "react";
import PirateStage, { type PiratePhase } from "./PirateStage";
import type { PirateState } from "@/lib/pirate/store";
import { countdownLeft, readyPhase, waitLeftSeconds, showGoBurst } from "@/lib/ukiki/ready";
import { requestNudge } from "@/lib/ukiki/nudge-client";

const POLL_MS = 700;

// 해적 무찌르기 실제 게임: 서버 상태를 자주 불러와 PirateStage 에 넣는다
export default function PirateGame({ roomCode, gameId, me }: { roomCode: string; gameId: number; me: string }) {
  const [state, setState] = useState<PirateState | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const api = `/api/ukiki/rooms/${roomCode}/pirate/${gameId}`;

  const load = useCallback(async () => {
    const res = await fetch(api, { cache: "no-store" }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; state?: PirateState } | null) : null;
    if (data?.ok && data.state) {
      setState(data.state);
      setOffset(new Date(data.state.serverNow).getTime() - Date.now());
    }
  }, [api]);

  useEffect(() => {
    void load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(t);
  }, []);

  const post = async (body: object) => {
    await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    await load();
  };

  if (!state) return <div style={{ position: "absolute", inset: 0, background: "#0a0a0a" }} />;

  const serverNow = now + offset;
  const startedMs = state.startedAt ? new Date(state.startedAt).getTime() : null;
  const rp = readyPhase(startedMs, serverNow);
  const phase: PiratePhase =
    state.status === "fail" ? "FAIL" : state.status === "success" ? "SUCCESS" : rp === "WAITING" ? "WAITING" : rp === "COUNTDOWN" ? "COUNTDOWN" : "PLAYING";
  const turnName = state.players.find((p) => p.id === state.turn)?.name ?? null;
  const myReady = state.players.find((p) => p.id === me)?.ready === true;

  return (
    <PirateStage
      backHref={`/r/${roomCode}`}
      cancelled={state.cancelled}
      wait={{ leftSeconds: waitLeftSeconds(state.waitUntil ? new Date(state.waitUntil).getTime() : null, serverNow), roomSize: state.roomSize }}
      phase={phase}
      players={state.players}
      meId={me}
      count={countdownLeft(startedMs, serverNow)}
      showGo={phase === "PLAYING" && showGoBurst(startedMs, serverNow)}
      turnName={turnName}
      turnLeft={state.turnUntil ? waitLeftSeconds(new Date(state.turnUntil).getTime(), serverNow) : undefined}
      myTurn={phase === "PLAYING" && state.turn === me}
      stabs={state.stabs.map((s) => s.hole)}
      onReady={() => post({ action: "ready", ready: !myReady })}
      onStab={(hole) => post({ action: "stab", hole })}
      onNudge={() => requestNudge(roomCode, gameId)}
    />
  );
}
