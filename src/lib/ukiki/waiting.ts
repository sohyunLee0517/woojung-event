// 대기실 공통 처리 (핀볼·과자·해적·AI 게임이 같이 쓴다).
// 게임별 테이블 이름만 다르고 규칙은 같다: 전원 준비완료면 바로, 아니면 제한 시간에 준비한 사람끼리, 2명이 안 되면 노게임.
import { getSql } from "@/lib/db";
import { WAIT_LIMIT_MS, waitOutcome } from "./ready";

/** 게임별 테이블 (코드에 적어 둔 이름만 쓴다) */
export const WAIT_TABLES = {
  pinball: { games: "uk_pinball_games", players: "uk_pinball_players" },
  snack: { games: "uk_snack_games", players: "uk_snack_players" },
  pirate: { games: "uk_pirate_games", players: "uk_pirate_players" },
  ai: { games: "uk_ai_rounds", players: "uk_ai_round_players" },
} as const;
export type WaitGame = keyof typeof WAIT_TABLES;

export type WaitDecision = { kind: "wait" | "cancelled" | "gone" } | { kind: "start"; members: string[] };

/**
 * 아직 시작 전인 게임을 살펴보고: 시작할 때면 { start, members(준비완료한 사람, 입장 순서) } 를 돌려주고,
 * 노게임이면 여기서 바로 닫는다(취소). 이미 시작했거나 끝난 게임이면 gone.
 */
export async function decideWaiting(code: string, id: number, game: WaitGame): Promise<WaitDecision> {
  const t = WAIT_TABLES[game];
  const sql = getSql();
  const rows = (await sql.query(
    `select extract(epoch from g.created_at) * 1000 as opened, extract(epoch from now()) * 1000 as now,
            (select count(*)::int from uk_room_members m where m.room_code = g.room_code) as room_size,
            array(select p.kakao_id from ${t.players} p where p.game_id = g.id and p.ready order by p.joined_at, p.kakao_id) as ready
     from uk_room_games g join ${t.games} x on x.game_id = g.id
     where g.id = $1 and g.room_code = $2 and g.status = 'active' and x.started_at is null`,
    [id, code],
  )) as { opened: number; now: number; room_size: number; ready: string[] }[];
  const r = rows[0];
  if (!r) return { kind: "gone" };
  const outcome = waitOutcome({ roomSize: Number(r.room_size), ready: r.ready.length, openedAt: Number(r.opened), now: Number(r.now) });
  if (outcome === "wait") return { kind: "wait" };
  if (outcome === "start") return { kind: "start", members: r.ready };
  // 노게임: 시작 전인 게임만 닫는다 (지난 게임에 안 남고 바나나도 없다)
  await sql.query(
    `update uk_room_games g set status = 'ended', outcome = 'cancelled', ended_at = now()
     where g.id = $1 and g.status = 'active'
       and exists (select 1 from ${t.games} x where x.game_id = g.id and x.started_at is null)`,
    [id],
  );
  return { kind: "cancelled" };
}

export type WaitInfo = { waitUntil: string | null; roomSize: number; cancelled: boolean };

/** 대기 화면에 보여 줄 것: 언제까지 기다리는지, 방 인원, 노게임으로 닫혔는지 */
export async function waitInfo(code: string, id: number): Promise<WaitInfo> {
  const rows = (await getSql()`
    select g.created_at, g.status, g.outcome,
           (select count(*)::int from uk_room_members m where m.room_code = g.room_code) as room_size
    from uk_room_games g where g.id = ${id} and g.room_code = ${code}
  `) as { created_at: string; status: string; outcome: string | null; room_size: number }[];
  const r = rows[0];
  if (!r) return { waitUntil: null, roomSize: 0, cancelled: false };
  return {
    waitUntil: new Date(new Date(r.created_at).getTime() + WAIT_LIMIT_MS).toISOString(),
    roomSize: Number(r.room_size),
    cancelled: r.status === "ended" && r.outcome === "cancelled",
  };
}
