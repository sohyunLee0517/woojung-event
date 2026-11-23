// 과자 나눠먹기 저장소 (Neon). 모두 자르기 전까지 남이 얼마나 잘랐는지는 내려주지 않는다.
import { getSql } from "@/lib/db";
import { enabledGames } from "@/lib/ukiki/features";
import { COUNTDOWN_MS } from "@/lib/ukiki/ready";
import { clampCut, judgeSnack, judgeSnackTimeout, SNACK_CUT_LIMIT_MS, type SnackResult } from "./logic";
import { decideWaiting, waitInfo, type WaitInfo } from "@/lib/ukiki/waiting";

async function isMember(code: string, me: string) {
  const rows = (await getSql()`select 1 from uk_room_members where room_code = ${code} and kakao_id = ${me}`) as unknown[];
  return rows.length > 0;
}

export type SnackCreateOutcome =
  | { kind: "created"; id: number }
  | { kind: "conflict"; id: number; message: string }
  | { kind: "not_member" | "disabled" | "retry" };

export async function createSnack(code: string, me: string): Promise<SnackCreateOutcome> {
  if (!(await isMember(code, me))) return { kind: "not_member" };
  if ((await enabledGames()).snack === false) return { kind: "disabled" };
  const sql = getSql();
  const rows = (await sql`
    insert into uk_room_games (room_code, game_type, host_kakao_id) values (${code}, 'snack', ${me})
    on conflict do nothing returning id
  `) as { id: number }[];
  if (rows[0]) {
    const id = Number(rows[0].id);
    await sql`insert into uk_snack_games (game_id) values (${id})`;
    await joinSnack(code, id, me);
    return { kind: "created", id };
  }
  const active = (await sql`
    select g.id, p.nickname from uk_room_games g join players p on p.kakao_id = g.host_kakao_id
    where g.room_code = ${code} and g.game_type = 'snack' and g.status = 'active'
  `) as { id: number; nickname: string | null }[];
  if (!active[0]) return { kind: "retry" };
  return { kind: "conflict", id: Number(active[0].id), message: `${active[0].nickname ?? "다른 친구"}님이 먼저 과자 나눠먹기를 열었어요` };
}

export async function joinSnack(code: string, id: number, me: string) {
  if (!(await isMember(code, me))) return false;
  await getSql()`
    insert into uk_snack_players (game_id, kakao_id)
    select g.id, ${me} from uk_room_games g where g.id = ${id} and g.room_code = ${code} and g.game_type = 'snack'
    on conflict do nothing
  `;
  return true;
}

/** 준비완료 (취소도 가능). 누른 뒤 바로 시작할 때인지 본다 */
export async function setSnackReady(code: string, id: number, me: string, ready: boolean) {
  await getSql()`
    update uk_snack_players sp set ready = ${ready}
    where sp.game_id = ${id} and sp.kakao_id = ${me}
      and exists (select 1 from uk_snack_games sg where sg.game_id = sp.game_id and sg.started_at is null)
  `;
  await tickSnack(code, id);
}

/** 대기실 규칙대로 시작하거나 닫는다. 시작하면 준비완료한 사람만 자른다 */
export async function tickSnack(code: string, id: number) {
  const d = await decideWaiting(code, id, "snack");
  if (d.kind === "start") {
    await getSql()`
      update uk_snack_games sg
      set started_at = now() + make_interval(secs => ${COUNTDOWN_MS / 1000}), members = ${d.members}
      where sg.game_id = ${id} and sg.started_at is null
    `;
    return;
  }
  if (d.kind === "gone") await finishSnackIfOver(id);
}

/** 결과 확정 (처음 한 번만) → 방 게임도 끝난 것으로 */
async function closeSnack(id: number, result: SnackResult) {
  const sql = getSql();
  const ended = (await sql`
    update uk_snack_games set status = ${result.status}, total = ${result.total} where game_id = ${id} and status = 'playing' returning game_id
  `) as unknown[];
  if (ended.length) await sql`update uk_room_games set status = 'ended', ended_at = now(), outcome = 'completed' where id = ${id} and status = 'active'`;
}

/** 자르기 시간(1분)이 지났으면 안 자른 사람은 0으로 치고 결과를 낸다 (시작한 게임은 노게임이 아니라 결과를 보여 준다) */
async function finishSnackIfOver(id: number) {
  const sql = getSql();
  const g = (await sql`
    select sg.members from uk_snack_games sg
    where sg.game_id = ${id} and sg.status = 'playing'
      and sg.started_at + make_interval(secs => ${SNACK_CUT_LIMIT_MS / 1000}) <= now()
  `) as { members: string[] | null }[];
  if (!g[0]) return;
  const cuts = (await sql`
    select sp.cut from uk_snack_players sp where sp.game_id = ${id} and sp.kakao_id = any(${g[0].members ?? []})
  `) as { cut: number | null }[];
  await closeSnack(id, judgeSnackTimeout(cuts.map((c) => (c.cut === null ? null : Number(c.cut)))));
}

export type SnackState = {
  id: number;
  me: string;
  /** cut 은 결과가 나온 뒤에만 */
  players: { id: string; name: string; ready: boolean; done: boolean; cut: number | null; member: boolean }[];
  startedAt: string | null;
  serverNow: string;
  myCut: number | null;
  result: SnackResult | null;
  /** 이 시각까지 자를 수 있다 (지나면 안 자른 사람은 0) */
  cutUntil: string | null;
} & WaitInfo;

export async function getSnackState(code: string, id: number, me: string): Promise<SnackState | null> {
  const sql = getSql();
  const g = (await sql`
    select sg.started_at, sg.members, sg.status, sg.total
    from uk_snack_games sg join uk_room_games r on r.id = sg.game_id
    where sg.game_id = ${id} and r.room_code = ${code}
  `) as { started_at: string | null; members: string[] | null; status: string; total: number | null }[];
  if (!g[0]) return null;
  const rows = (await sql`
    select sp.kakao_id, p.nickname, sp.ready, sp.cut from uk_snack_players sp join players p on p.kakao_id = sp.kakao_id
    where sp.game_id = ${id} order by sp.joined_at, sp.kakao_id
  `) as { kakao_id: string; nickname: string | null; ready: boolean; cut: number | null }[];
  const members = g[0].members ?? [];
  const result: SnackResult | null = g[0].status === "playing" ? null : { status: g[0].status as "success" | "fail", total: Number(g[0].total) };
  return {
    id,
    me,
    players: rows.map((r) => ({
      id: r.kakao_id,
      name: r.nickname ?? "친구",
      ready: r.ready,
      done: r.cut !== null,
      cut: result ? r.cut : null,
      member: g[0].started_at === null || members.includes(r.kakao_id),
    })),
    startedAt: g[0].started_at ? new Date(g[0].started_at).toISOString() : null,
    serverNow: new Date().toISOString(),
    cutUntil: g[0].started_at ? new Date(new Date(g[0].started_at).getTime() + SNACK_CUT_LIMIT_MS).toISOString() : null,
    myCut: rows.find((r) => r.kakao_id === me)?.cut ?? null,
    result,
    ...(await waitInfo(code, id)),
  };
}

export type CutResult = { ok: true } | { ok: false; reason: "not_started" | "ended" | "not_player" | "already_cut" | "not_found" };

/** 한 번만 자르기 (자르는 순간 확정). 마지막 사람이 자르면 결과를 낸다 */
export async function cutSnack(code: string, id: number, me: string, amount: number): Promise<CutResult> {
  const sql = getSql();
  const g = (await sql`
    select sg.started_at <= now() as started, sg.members, sg.status
    from uk_snack_games sg join uk_room_games r on r.id = sg.game_id
    where sg.game_id = ${id} and r.room_code = ${code}
  `) as { started: boolean | null; members: string[] | null; status: string }[];
  if (!g[0]) return { ok: false, reason: "not_found" };
  if (g[0].status !== "playing") return { ok: false, reason: "ended" };
  if (!g[0].started) return { ok: false, reason: "not_started" };
  if (!(g[0].members ?? []).includes(me)) return { ok: false, reason: "not_player" };
  const done = (await sql`
    update uk_snack_players set cut = ${clampCut(amount)}, cut_at = now()
    where game_id = ${id} and kakao_id = ${me} and cut is null returning kakao_id
  `) as unknown[];
  if (done.length === 0) return { ok: false, reason: "already_cut" };

  const cuts = (await sql`
    select sp.cut from uk_snack_players sp where sp.game_id = ${id} and sp.kakao_id = any(${g[0].members})
  `) as { cut: number | null }[];
  const result = judgeSnack(cuts.map((c) => (c.cut === null ? null : Number(c.cut))));
  if (result) await closeSnack(id, result);
  return { ok: true };
}
