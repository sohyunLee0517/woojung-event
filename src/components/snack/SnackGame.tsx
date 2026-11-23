"use client";

import { useCallback, useEffect, useState } from "react";
import SnackStage, { type SnackPhase } from "./SnackStage";
import type { SnackState } from "@/lib/snack/store";
import { countdownLeft, readyPhase, waitLeftSeconds, showGoBurst } from "@/lib/ukiki/ready";
import { requestNudge } from "@/lib/ukiki/nudge-client";

const POLL_MS = 800;

// 과자 나눠먹기 실제 게임: 서버 상태를 자주 불러와 SnackStage 에 넣는다
export default function SnackGame({ roomCode, gameId, me }: { roomCode: string; gameId: number; me: string }) {
  const [state, setState] = useState<SnackState | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const api = `/api/ukiki/rooms/${roomCode}/snack/${gameId}`;

  const load = useCallback(async () => {
    const res = await fetch(api, { cache: "no-store" }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; state?: SnackState } | null) : null;
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
  const meRow = state.players.find((p) => p.id === me);
  const spectator = state.startedAt !== null && !meRow?.member;
  const phase: SnackPhase = state.result
    ? "RESULT"
    : rp === "WAITING"
      ? "WAITING"
      : rp === "COUNTDOWN"
        ? "COUNTDOWN"
        : state.myCut === null && !spectator
          ? "CUTTING"
          : "DONE";
  const players = state.players.filter((p) => p.member);

  return (
    <SnackStage
      backHref={`/r/${roomCode}`}
      cancelled={state.cancelled}
      wait={{ leftSeconds: waitLeftSeconds(state.waitUntil ? new Date(state.waitUntil).getTime() : null, serverNow), roomSize: state.roomSize }}
      phase={phase}
      players={players}
      meId={me}
      count={countdownLeft(startedMs, serverNow)}
      showGo={phase === "CUTTING" && showGoBurst(startedMs, serverNow)}
      myCut={state.myCut}
      total={state.result?.total ?? null}
      failed={state.result?.status === "fail"}
      spectator={spectator}
      cutLeft={state.cutUntil && !state.result ? waitLeftSeconds(new Date(state.cutUntil).getTime(), serverNow) : undefined}
      onReady={() => post({ action: "ready", ready: !meRow?.ready })}
      onCut={(amount) => post({ action: "cut", amount })}
      onNudge={() => requestNudge(roomCode, gameId)}
    />
  );
}
