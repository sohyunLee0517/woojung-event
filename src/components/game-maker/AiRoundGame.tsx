"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopBar from "@/components/ukiki/TopBar";
import BackToRoom from "@/components/ukiki/BackToRoom";
import { CountdownView, GoBurst, ReadyStyles, ReadyWaiting, readyCenter } from "@/components/ukiki/ReadyRoom";
import { countdownLeft, readyPhase, showGoBurst } from "@/lib/ukiki/ready";
import { requestNudge } from "@/lib/ukiki/nudge-client";
import type { AiRoundState } from "@/lib/game-maker/round-store";
import type { KitEvent, KitMessage, KitPlayer } from "@/lib/game-maker/kit";
import GameFrame from "./GameFrame";
import AiResult from "./AiResult";

const WAIT_POLL_MS = 700;
const PLAY_POLL_MS = 450;
export const PLAYER_EMOJIS = ["🐵", "🐰", "🐻", "🦊", "🐱", "🐶", "🐼", "🐸"];

// 우리가 만든 게임 한 판. 준비완료 → 3·2·1 → 시작! → 결과 → 방으로 는 다른 게임과 똑같고,
// '시작!' 뒤의 본게임 자리에만 AI가 만든 게임(iframe)이 들어간다.
export default function AiRoundGame({ roomCode, gameId, me }: { roomCode: string; gameId: number; me: string }) {
  const api = `/api/ukiki/rooms/${roomCode}/ai/${gameId}`;
  const [state, setState] = useState<AiRoundState | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [events, setEvents] = useState<KitEvent[]>([]);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const lastSeq = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch(`${api}?after=${lastSeq.current}`, { cache: "no-store" }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; state?: AiRoundState } | null) : null;
    if (!data?.ok || !data.state) return;
    const s = data.state;
    setState(s);
    setOffset(new Date(s.serverNow).getTime() - Date.now());
    if (s.html) setHtml((h) => h ?? s.html);
    const fresh = s.events.filter((e) => e.seq > lastSeq.current);
    if (fresh.length) {
      lastSeq.current = fresh[fresh.length - 1].seq;
      setEvents((prev) => [...prev, ...fresh]);
    }
  }, [api]);

  const started = !!state?.startedAt && now + offset >= new Date(state.startedAt).getTime();
  const ended = !!state?.result;
  useEffect(() => {
    void load();
    if (ended) return;
    const t = setInterval(load, started ? PLAY_POLL_MS : WAIT_POLL_MS);
    return () => clearInterval(t);
  }, [load, started, ended]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(t);
  }, []);

  // 참여자 이모지는 입장 순서대로 고정
  const membersKey = state ? JSON.stringify([state.members, state.players.map((p) => p.name)]) : "";
  const kitPlayers: KitPlayer[] = useMemo(() => {
    if (!state) return [];
    const ids = state.members.length ? state.members : state.players.map((p) => p.id);
    return ids.map((id, i) => ({ id, name: state.players.find((p) => p.id === id)?.name ?? "친구", emoji: PLAYER_EMOJIS[i % PLAYER_EMOJIS.length] }));
  }, [membersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKit = useCallback(
    async (m: Exclude<KitMessage, { type: "ready" }>) => {
      await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "kit", message: { ...m, __ukiki: true } }) }).catch(() => null);
      void load();
    },
    [api, load],
  );

  if (!state) return <div style={{ position: "absolute", inset: 0, background: "#0d0d14" }} />;

  const serverNow = now + offset;
  const startedMs = state.startedAt ? new Date(state.startedAt).getTime() : null;
  const rp = readyPhase(startedMs, serverNow);
  const myReady = state.players.find((p) => p.id === me)?.ready === true;
  const iPlay = state.members.includes(me);
  const backHref = `/r/${roomCode}`;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", color: "#fff", fontFamily: "sans-serif", background: "#0d0d14", userSelect: "none" }}>
      <ReadyStyles />
      <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <TopBar
          backHref={backHref}
          title={`${state.emoji} ${state.title}`}
          sub={
            <p style={{ fontSize: 12, opacity: 0.6 }}>
              🤖 우리가 만든 게임 · 👥 {state.members.length || state.players.length}명 ·{" "}
              <a href={`/report?room=${roomCode}&aiGame=${state.aiGameId}`} style={{ color: "inherit" }}>
                🚩 신고
              </a>
            </p>
          }
        />
        {rp === "WAITING" && (
          <>
            {state.rules && <p style={{ fontSize: 13, opacity: 0.75, textAlign: "center" }}>📜 {state.rules}</p>}
            <ReadyWaiting
              players={state.players}
              meId={me}
              emoji={state.emoji}
              onReady={async () => {
                await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ready", ready: !myReady }) }).catch(() => null);
                await load();
              }}
              onNudge={() => requestNudge(roomCode, gameId)}
            />
          </>
        )}
        {rp === "COUNTDOWN" && <CountdownView count={countdownLeft(startedMs, serverNow)} hint={state.rules ?? `${state.emoji} ${state.title}`} />}
        {rp === "STARTED" && (
          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
            {state.result ? (
              <AiResult title={state.title} emoji={state.emoji} players={kitPlayers} result={state.result} me={me} backHref={backHref} showBananas={iPlay} />
            ) : !iPlay ? (
              <div style={readyCenter}>
                <p style={{ fontSize: 48 }}>{state.emoji}</p>
                <p style={{ fontWeight: 800 }}>이미 시작한 게임이에요</p>
                <p style={{ fontSize: 13, opacity: 0.7 }}>끝나면 결과를 보여 줄게요. 다음 판에 같이 해요!</p>
                <BackToRoom href={backHref} />
              </div>
            ) : html && state.seed !== null ? (
              <>
                <GameFrame html={html} boot={{ mode: "play", me, players: kitPlayers, seed: state.seed }} events={events} onMessage={onKit} />
                {showGoBurst(startedMs, serverNow) && <GoBurst />}
              </>
            ) : (
              <div style={readyCenter}>
                <p style={{ opacity: 0.6 }}>게임을 불러오는 중…</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
