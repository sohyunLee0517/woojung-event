// 방에서 AI 게임 한 판 (Neon). 흐름은 다른 게임과 같다:
//   열기 → 화면에 들어오면 참여 → 모두 준비완료(2명 이상) → 3·2·1 → 시작 → 결과 → 방으로
// 게임 안에서 주고받는 메시지는 uk_ai_round_events 에 쌓고, 화면이 짧게 폴링해서 같은 순서로 받는다.
import { getSql } from "@/lib/db";
import { enabledGames } from "@/lib/ukiki/features";
import { COUNTDOWN_MS } from "@/lib/ukiki/ready";
import type { KitEndResult, KitEvent } from "./kit";
import { AI_ROUND_MAX_MS, normalizeEnd, winnersFromScores } from "./round";

async function isMember(code: string, me: string) {
  const rows = (await getSql()`select 1 from uk_room_members where room_code = ${code} and kakao_id = ${me}`) as unknown[];
  return rows.length > 0;
}

export type AiRoundCreateOutcome =
  | { kind: "created"; id: number }
  | { kind: "conflict"; id: number; hostName: string | null; message: string }
  | { kind: "not_member" | "disabled" | "not_found" | "retry" };

/** 확정된 AI 게임으로 한 판 열기 (방마다 진행 중인 AI 게임은 하나) */
export async function createAiRound(code: string, me: string, aiGameId: number): Promise<AiRoundCreateOutcome> {
  if (!(await isMember(code, me))) return { kind: "not_member" };
  if ((await enabledGames()).ai === false) return { kind: "disabled" };
  const sql = getSql();
  const game = (await sql`
    select id, published_version from uk_ai_games where id = ${aiGameId} and room_code = ${code} and status = 'published'
  `) as { id: number; published_version: number }[];
  if (!game[0]) return { kind: "not_found" };
  const rows = (await sql`
    insert into uk_room_games (room_code, game_type, host_kakao_id, ref_code) values (${code}, 'ai', ${me}, ${String(aiGameId)})
    on conflict do nothing returning id
  `) as { id: number }[];
  if (rows[0]) {
    const id = Number(rows[0].id);
    await sql`insert into uk_ai_rounds (game_id, ai_game_id, version) values (${id}, ${aiGameId}, ${game[0].published_version})`;
    await joinAiRound(code, id, me);
    return { kind: "created", id };
  }
  const active = (await sql`
    select g.id, p.nickname, a.title from uk_room_games g
      join players p on p.kakao_id = g.host_kakao_id
      join uk_ai_rounds r on r.game_id = g.id join uk_ai_games a on a.id = r.ai_game_id
    where g.room_code = ${code} and g.game_type = 'ai' and g.status = 'active'
  `) as { id: number; nickname: string | null; title: string }[];
  if (!active[0]) return { kind: "retry" };
  return {
    kind: "conflict",
    id: Number(active[0].id),
    hostName: active[0].nickname,
    message: `${active[0].nickname ?? "다른 친구"}님이 먼저 '${active[0].title}' 을(를) 열었어요`,
  };
}

/** 화면에 들어오면 참여 (방 멤버만, 시작 전까지만) */
export async function joinAiRound(code: string, id: number, me: string) {
  if (!(await isMember(code, me))) return false;
  await getSql()`
    insert into uk_ai_round_players (game_id, kakao_id)
    select g.id, ${me} from uk_room_games g join uk_ai_rounds r on r.game_id = g.id
    where g.id = ${id} and g.room_code = ${code} and g.game_type = 'ai' and r.started_at is null
    on conflict do nothing
  `;
  return true;
}

/** 준비완료. 2명 이상 모두 준비면 3초 뒤 시작: 시드·참여자 확정 */
export async function setAiRoundReady(code: string, id: number, me: string, ready: boolean) {
  const sql = getSql();
  await sql`update uk_ai_round_players set ready = ${ready} where game_id = ${id} and kakao_id = ${me}`;
  const seed = Math.floor(Math.random() * 2147483647);
  await sql`
    update uk_ai_rounds r
    set started_at = now() + make_interval(secs => ${COUNTDOWN_MS / 1000}),
        seed = ${seed},
        members = (select array_agg(p.kakao_id order by p.joined_at, p.kakao_id) from uk_ai_round_players p where p.game_id = r.game_id)
    where r.game_id = ${id} and r.started_at is null
      and exists (select 1 from uk_room_games g where g.id = ${id} and g.room_code = ${code})
      and (select count(*) from uk_ai_round_players p where p.game_id = r.game_id) >= 2
      and not exists (select 1 from uk_ai_round_players p where p.game_id = r.game_id and not p.ready)
  `;
}

/** 끝내기 (처음 한 번만). 방 게임도 끝난 것으로 → 지난 게임에 나오고 바나나 정산 대상이 된다 */
async function closeRound(id: number, result: KitEndResult) {
  const sql = getSql();
  const done = (await sql`
    update uk_ai_rounds set ended_at = now(), winners = ${result.winners}, team_success = ${result.teamSuccess}
    where game_id = ${id} and ended_at is null
    returning game_id
  `) as unknown[];
  if (done.length) {
    await sql`update uk_room_games set status = 'ended', outcome = 'completed', ended_at = now() where id = ${id} and status = 'active'`;
  }
}

type PlayingRow = { members: string[]; started: boolean; ended: boolean };

/** 시작했고 아직 안 끝났고 내가 참여자일 때만 */
async function playing(code: string, id: number, me: string): Promise<PlayingRow | null> {
  const rows = (await getSql()`
    select r.members, r.started_at <= now() as started, r.ended_at is not null as ended
    from uk_ai_rounds r join uk_room_games g on g.id = r.game_id
    where r.game_id = ${id} and g.room_code = ${code}
  `) as { members: string[] | null; started: boolean | null; ended: boolean }[];
  const r = rows[0];
  if (!r || !r.started || r.ended || !(r.members ?? []).includes(me)) return null;
  return { members: r.members ?? [], started: true, ended: false };
}

/** 게임 안 메시지 보내기 (모두 같은 순서로 받는다) */
export async function postAiEvent(code: string, id: number, me: string, data: unknown): Promise<boolean> {
  if (!(await playing(code, id, me))) return false;
  await getSql()`insert into uk_ai_round_events (game_id, kakao_id, data) values (${id}, ${me}, ${JSON.stringify(data ?? null)}::jsonb)`;
  return true;
}

/** 내 점수. 모두 내면 최고점이 1등으로 끝난다 */
export async function submitAiScore(code: string, id: number, me: string, value: number) {
  const r = await playing(code, id, me);
  if (!r || !Number.isFinite(value)) return false;
  const sql = getSql();
  await sql`update uk_ai_round_players set score = ${value} where game_id = ${id} and kakao_id = ${me}`;
  const rows = (await sql`select kakao_id, score from uk_ai_round_players where game_id = ${id}`) as { kakao_id: string; score: number | null }[];
  const scores = Object.fromEntries(rows.map((x) => [x.kakao_id, x.score === null ? null : Number(x.score)]));
  const winners = winnersFromScores(scores, r.members);
  if (winners) await closeRound(id, { winners, teamSuccess: false });
  return true;
}

/** 게임이 결과를 알림 (여럿이 불러도 처음 것만) */
export async function endAiRound(code: string, id: number, me: string, result: KitEndResult) {
  const r = await playing(code, id, me);
  if (!r) return false;
  await closeRound(id, normalizeEnd(result, r.members));
  return true;
}

export type AiRoundState = {
  id: number;
  me: string;
  aiGameId: number;
  title: string;
  emoji: string;
  rules: string | null;
  players: { id: string; name: string; ready: boolean }[];
  startedAt: string | null;
  serverNow: string;
  seed: number | null;
  members: string[];
  /** 시작한 뒤에만 내려준다 */
  html: string | null;
  events: KitEvent[];
  result: KitEndResult | null;
  scores: Record<string, number | null>;
};

export async function getAiRoundState(code: string, id: number, me: string, afterSeq: number): Promise<AiRoundState | null> {
  const sql = getSql();
  const rows = (await sql`
    select r.ai_game_id, r.version, r.started_at, r.seed, r.members, r.ended_at, r.winners, r.team_success,
           v.title, v.emoji, v.rules, (r.started_at <= now()) as started
    from uk_ai_rounds r join uk_room_games g on g.id = r.game_id
      join uk_ai_game_versions v on v.ai_game_id = r.ai_game_id and v.version = r.version
    where r.game_id = ${id} and g.room_code = ${code}
  `) as {
    ai_game_id: number;
    version: number;
    started_at: string | null;
    seed: number | null;
    members: string[] | null;
    ended_at: string | null;
    winners: string[] | null;
    team_success: boolean | null;
    title: string;
    emoji: string;
    rules: string | null;
    started: boolean | null;
  }[];
  const r = rows[0];
  if (!r) return null;

  // 너무 오래 안 끝나면 승자 없이 끝낸다
  if (r.started_at && !r.ended_at && Date.now() - new Date(r.started_at).getTime() > AI_ROUND_MAX_MS) {
    await closeRound(id, { winners: [], teamSuccess: false });
    return getAiRoundState(code, id, me, afterSeq);
  }

  const players = (await sql`
    select rp.kakao_id, p.nickname, rp.ready, rp.score from uk_ai_round_players rp join players p on p.kakao_id = rp.kakao_id
    where rp.game_id = ${id} order by rp.joined_at, rp.kakao_id
  `) as { kakao_id: string; nickname: string | null; ready: boolean; score: number | null }[];

  let html: string | null = null;
  let events: KitEvent[] = [];
  if (r.started) {
    if (afterSeq === 0) {
      const v = (await sql`select html from uk_ai_game_versions where ai_game_id = ${r.ai_game_id} and version = ${r.version}`) as { html: string }[];
      html = v[0]?.html ?? null;
    }
    const ev = (await sql`
      select id, kakao_id, data from uk_ai_round_events where game_id = ${id} and id > ${afterSeq} order by id limit 200
    `) as { id: number; kakao_id: string; data: unknown }[];
    events = ev.map((e) => ({ seq: Number(e.id), from: e.kakao_id, data: e.data }));
  }

  return {
    id,
    me,
    aiGameId: Number(r.ai_game_id),
    title: r.title,
    emoji: r.emoji,
    rules: r.rules,
    players: players.map((p) => ({ id: p.kakao_id, name: p.nickname ?? "친구", ready: p.ready })),
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    serverNow: new Date().toISOString(),
    seed: r.seed === null ? null : Number(r.seed),
    members: r.members ?? [],
    html,
    events,
    result: r.ended_at ? { winners: r.winners ?? [], teamSuccess: r.team_success === true } : null,
    scores: Object.fromEntries(players.map((p) => [p.kakao_id, p.score === null ? null : Number(p.score)])),
  };
}
