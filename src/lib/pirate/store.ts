// 해적 무찌르기 저장소 (Neon). 함정 위치는 서버에만 두고, 게임이 끝난 뒤에만 화면에 내려준다.
import { getSql } from "@/lib/db";
import { enabledGames } from "@/lib/ukiki/features";
import { COUNTDOWN_MS } from "@/lib/ukiki/ready";
import { HOLES, judgeStab, pickTrap, turnOf, type PirateStatus, type StabOutcome } from "./logic";

async function isMember(code: string, me: string) {
  const rows = (await getSql()`select 1 from uk_room_members where room_code = ${code} and kakao_id = ${me}`) as unknown[];
  return rows.length > 0;
}

export type PirateCreateOutcome =
  | { kind: "created"; id: number }
  | { kind: "conflict"; id: number; hostName: string | null; message: string }
  | { kind: "not_member" | "disabled" | "retry" };

/** 해적 한 판 열기 (방마다 하나). 연 사람은 첫 번째 차례로 들어간다 */
export async function createPirate(code: string, me: string): Promise<PirateCreateOutcome> {
  if (!(await isMember(code, me))) return { kind: "not_member" };
  if ((await enabledGames()).pirate === false) return { kind: "disabled" };
  const sql = getSql();
  const rows = (await sql`
    insert into uk_room_games (room_code, game_type, host_kakao_id) values (${code}, 'pirate', ${me})
    on conflict do nothing returning id
  `) as { id: number }[];
  if (rows[0]) {
    const id = Number(rows[0].id);
    await sql`insert into uk_pirate_games (game_id, trap_hole) values (${id}, ${pickTrap()})`;
    await joinPirate(code, id, me);
    return { kind: "created", id };
  }
  const active = (await sql`
    select g.id, p.nickname from uk_room_games g join players p on p.kakao_id = g.host_kakao_id
    where g.room_code = ${code} and g.game_type = 'pirate' and g.status = 'active'
  `) as { id: number; nickname: string | null }[];
  if (!active[0]) return { kind: "retry" };
  return {
    kind: "conflict",
    id: Number(active[0].id),
    hostName: active[0].nickname,
    message: `${active[0].nickname ?? "다른 친구"}님이 먼저 해적 무찌르기를 열었어요`,
  };
}

/** 화면에 들어오면 참여 (방 멤버만, 여러 번 들어와도 한 번). 들어왔으면 true */
export async function joinPirate(code: string, id: number, me: string) {
  if (!(await isMember(code, me))) return false;
  await getSql()`
    insert into uk_pirate_players (game_id, kakao_id)
    select g.id, ${me} from uk_room_games g where g.id = ${id} and g.room_code = ${code} and g.game_type = 'pirate'
    on conflict do nothing
  `;
  return true;
}

/** 준비완료. 들어온 사람이 2명 이상이고 모두 준비면 3초 뒤 시작, 차례는 입장 순서 */
export async function setPirateReady(code: string, id: number, me: string, ready: boolean) {
  const sql = getSql();
  await sql`update uk_pirate_players set ready = ${ready} where game_id = ${id} and kakao_id = ${me}`;
  await sql`
    update uk_pirate_games pg
    set started_at = now() + make_interval(secs => ${COUNTDOWN_MS / 1000}),
        turn_order = (select array_agg(pp.kakao_id order by pp.joined_at, pp.kakao_id) from uk_pirate_players pp where pp.game_id = pg.game_id)
    where pg.game_id = ${id} and pg.started_at is null
      and exists (select 1 from uk_room_games g where g.id = ${id} and g.room_code = ${code})
      and (select count(*) from uk_pirate_players pp where pp.game_id = pg.game_id) >= 2
      and not exists (select 1 from uk_pirate_players pp where pp.game_id = pg.game_id and not pp.ready)
  `;
}

export type PirateState = {
  id: number;
  me: string;
  players: { id: string; name: string; ready: boolean }[];
  startedAt: string | null;
  serverNow: string;
  order: string[];
  turn: string | null;
  stabs: { hole: number; kakaoId: string }[];
  status: PirateStatus;
  /** 끝난 뒤에만 */
  trap?: number;
};

export async function getPirateState(code: string, id: number, me: string): Promise<PirateState | null> {
  const sql = getSql();
  const g = (await sql`
    select pg.trap_hole, pg.started_at, pg.turn_order, pg.status
    from uk_pirate_games pg join uk_room_games r on r.id = pg.game_id
    where pg.game_id = ${id} and r.room_code = ${code}
  `) as { trap_hole: number; started_at: string | null; turn_order: string[] | null; status: "playing" | "fail" | "success" }[];
  if (!g[0]) return null;
  const players = (await sql`
    select pp.kakao_id, p.nickname, pp.ready from uk_pirate_players pp join players p on p.kakao_id = pp.kakao_id
    where pp.game_id = ${id} order by pp.joined_at, pp.kakao_id
  `) as { kakao_id: string; nickname: string | null; ready: boolean }[];
  const stabs = (await sql`select hole, kakao_id from uk_pirate_stabs where game_id = ${id} order by seq`) as {
    hole: number;
    kakao_id: string;
  }[];
  const order = g[0].turn_order ?? [];
  const ended = g[0].status !== "playing";
  const status: PirateStatus = g[0].started_at === null ? "waiting" : g[0].status;
  return {
    id,
    me,
    players: players.map((p) => ({ id: p.kakao_id, name: p.nickname ?? "친구", ready: p.ready })),
    startedAt: g[0].started_at ? new Date(g[0].started_at).toISOString() : null,
    serverNow: new Date().toISOString(),
    order,
    turn: status === "playing" ? turnOf(order, stabs.length) : null,
    stabs: stabs.map((s) => ({ hole: Number(s.hole), kakaoId: s.kakao_id })),
    status,
    ...(ended ? { trap: Number(g[0].trap_hole) } : {}),
  };
}

export type StabResult =
  | { ok: true; outcome: StabOutcome }
  | { ok: false; reason: "not_started" | "ended" | "not_your_turn" | "taken" | "bad_hole" | "busy" | "not_found" };

/** 내 차례에 구멍 하나에 칼 꽂기 */
export async function stab(code: string, id: number, me: string, hole: number): Promise<StabResult> {
  if (!Number.isInteger(hole) || hole < 0 || hole >= HOLES) return { ok: false, reason: "bad_hole" };
  const sql = getSql();
  const g = (await sql`
    select pg.trap_hole, pg.started_at <= now() as started, pg.turn_order, pg.status,
           (select count(*)::int from uk_pirate_stabs s where s.game_id = pg.game_id) as n
    from uk_pirate_games pg join uk_room_games r on r.id = pg.game_id
    where pg.game_id = ${id} and r.room_code = ${code}
  `) as { trap_hole: number; started: boolean | null; turn_order: string[] | null; status: string; n: number }[];
  const game = g[0];
  if (!game) return { ok: false, reason: "not_found" };
  if (game.status !== "playing") return { ok: false, reason: "ended" };
  if (!game.started) return { ok: false, reason: "not_started" };
  if (turnOf(game.turn_order ?? [], game.n) !== me) return { ok: false, reason: "not_your_turn" };

  const inserted = (await sql`
    insert into uk_pirate_stabs (game_id, seq, hole, kakao_id) values (${id}, ${game.n}, ${hole}, ${me})
    on conflict do nothing returning seq
  `) as unknown[];
  if (inserted.length === 0) {
    const taken = (await sql`select 1 from uk_pirate_stabs where game_id = ${id} and hole = ${hole}`) as unknown[];
    return { ok: false, reason: taken.length ? "taken" : "busy" };
  }

  const outcome = judgeStab({ hole, trap: Number(game.trap_hole), stabbedBefore: game.n });
  if (outcome !== "continue") {
    await sql`update uk_pirate_games set status = ${outcome} where game_id = ${id}`;
    await sql`update uk_room_games set status = 'ended', ended_at = now(), outcome = 'completed' where id = ${id} and status = 'active'`;
  }
  return { ok: true, outcome };
}
