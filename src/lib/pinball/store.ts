// 랜덤 핀볼 저장소 (Neon). 모두 준비하면 시드를 정하고, 그 시드로 순서를 서버가 미리 계산해 둔다.
// 화면은 같은 시드로 같은 장면을 그리므로 모든 폰에서 결과가 같다.
import { getSql } from "@/lib/db";
import { enabledGames } from "@/lib/ukiki/features";
import { COUNTDOWN_MS } from "@/lib/ukiki/ready";
import { simulateOrder } from "./logic";
import { decideWaiting, waitInfo, type WaitInfo } from "@/lib/ukiki/waiting";

async function isMember(code: string, me: string) {
  const rows = (await getSql()`select 1 from uk_room_members where room_code = ${code} and kakao_id = ${me}`) as unknown[];
  return rows.length > 0;
}

export type PinballCreateOutcome =
  | { kind: "created"; id: number }
  | { kind: "conflict"; id: number; hostName: string | null; message: string }
  | { kind: "not_member" | "disabled" | "retry" };

/** 핀볼 한 판 열기 (방마다 하나) */
export async function createPinball(code: string, me: string): Promise<PinballCreateOutcome> {
  if (!(await isMember(code, me))) return { kind: "not_member" };
  if ((await enabledGames()).pinball === false) return { kind: "disabled" };
  const sql = getSql();
  const rows = (await sql`
    insert into uk_room_games (room_code, game_type, host_kakao_id) values (${code}, 'pinball', ${me})
    on conflict do nothing returning id
  `) as { id: number }[];
  if (rows[0]) {
    const id = Number(rows[0].id);
    await sql`insert into uk_pinball_games (game_id) values (${id})`;
    await joinPinball(code, id, me);
    return { kind: "created", id };
  }
  const active = (await sql`
    select g.id, p.nickname from uk_room_games g join players p on p.kakao_id = g.host_kakao_id
    where g.room_code = ${code} and g.game_type = 'pinball' and g.status = 'active'
  `) as { id: number; nickname: string | null }[];
  if (!active[0]) return { kind: "retry" };
  return {
    kind: "conflict",
    id: Number(active[0].id),
    hostName: active[0].nickname,
    message: `${active[0].nickname ?? "다른 친구"}님이 먼저 랜덤 핀볼을 열었어요`,
  };
}

/** 화면에 들어오면 참여 (방 멤버만, 시작 전까지만). 참여 중이면 true */
export async function joinPinball(code: string, id: number, me: string) {
  if (!(await isMember(code, me))) return false;
  await getSql()`
    insert into uk_pinball_players (game_id, kakao_id)
    select g.id, ${me} from uk_room_games g join uk_pinball_games pg on pg.game_id = g.id
    where g.id = ${id} and g.room_code = ${code} and g.game_type = 'pinball' and pg.started_at is null
    on conflict do nothing
  `;
  return true;
}

/** 준비완료 (취소도 가능). 누른 뒤 바로 시작할 때인지 본다 */
export async function setPinballReady(code: string, id: number, me: string, ready: boolean) {
  await getSql()`
    update uk_pinball_players pp set ready = ${ready}
    where pp.game_id = ${id} and pp.kakao_id = ${me}
      and exists (select 1 from uk_pinball_games pg where pg.game_id = pp.game_id and pg.started_at is null)
  `;
  await tickPinball(code, id);
}

/**
 * 대기실 규칙대로 시작하거나 닫는다 (준비 누를 때·화면이 상태를 불러올 때마다 부른다).
 * 시작: 3초 뒤로 시작 시각·시드·참여자(준비완료한 사람)를 확정하고 순서를 계산, 순위가 정해졌으니 바로 지난 게임으로.
 */
export async function tickPinball(code: string, id: number) {
  const d = await decideWaiting(code, id, "pinball");
  if (d.kind !== "start") return;
  const sql = getSql();
  const seed = Math.floor(Math.random() * 2147483647);
  const started = (await sql`
    update uk_pinball_games pg
    set started_at = now() + make_interval(secs => ${COUNTDOWN_MS / 1000}), seed = ${seed}, members = ${d.members}
    where pg.game_id = ${id} and pg.started_at is null
    returning pg.members
  `) as { members: string[] }[];
  if (!started[0]) return;
  const order = simulateOrder(started[0].members, seed);
  await sql`update uk_pinball_games set result_order = ${order} where game_id = ${id}`;
  await sql`
    update uk_room_games set status = 'ended', outcome = 'completed',
      ended_at = now()
    where id = ${id} and status = 'active'
  `;
}

export type PinballState = {
  id: number;
  me: string;
  players: { id: string; name: string; ready: boolean }[];
  startedAt: string | null;
  serverNow: string;
  seed: number | null;
  /** 구슬을 굴릴 사람 (입장 순서) */
  members: string[];
  /** 도착 순서 (1등 = 오늘의 주인공) */
  order: string[];
} & WaitInfo;

export async function getPinballState(code: string, id: number, me: string): Promise<PinballState | null> {
  const sql = getSql();
  const g = (await sql`
    select pg.started_at, pg.seed, pg.members, pg.result_order
    from uk_pinball_games pg join uk_room_games r on r.id = pg.game_id
    where pg.game_id = ${id} and r.room_code = ${code}
  `) as { started_at: string | null; seed: number | null; members: string[] | null; result_order: string[] | null }[];
  if (!g[0]) return null;
  const players = (await sql`
    select pp.kakao_id, p.nickname, pp.ready from uk_pinball_players pp join players p on p.kakao_id = pp.kakao_id
    where pp.game_id = ${id} order by pp.joined_at, pp.kakao_id
  `) as { kakao_id: string; nickname: string | null; ready: boolean }[];
  return {
    id,
    me,
    players: players.map((p) => ({ id: p.kakao_id, name: p.nickname ?? "친구", ready: p.ready })),
    startedAt: g[0].started_at ? new Date(g[0].started_at).toISOString() : null,
    serverNow: new Date().toISOString(),
    seed: g[0].seed === null ? null : Number(g[0].seed),
    members: g[0].members ?? [],
    order: g[0].result_order ?? [],
    ...(await waitInfo(code, id)),
  };
}
