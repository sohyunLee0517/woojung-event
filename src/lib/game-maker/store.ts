// AI 게임 저장소 (Neon). 지금은 '방 전용'이라 게임마다 room_code 가 붙지만,
// 방에 대한 건 '이 방 멤버인가' 확인 하나뿐이라 나중에 다른 곳(홈·마을)으로 옮기기 쉽다.
import { getSql } from "@/lib/db";
import { refundBananas } from "@/lib/bananas/store";
import { AUTOFIX_MAX } from "./smoke";
import { validateGameHtml } from "./prompt";

/** 이만큼 지나도 끝나지 않은 생성은 실패로 보고 환불한다 (서버가 중간에 멈춘 경우) */
export const PENDING_STALE_MS = 6 * 60_000;
/** 방마다 확정된 AI 게임은 최대 이만큼 */
export const AI_GAMES_PER_ROOM = 10;

async function isMember(code: string, me: string) {
  const rows = (await getSql()`select 1 from uk_room_members where room_code = ${code} and kakao_id = ${me}`) as unknown[];
  return rows.length > 0;
}

export type AiGameSummary = {
  id: number;
  title: string;
  emoji: string;
  rules: string | null;
  status: "draft" | "published" | "hidden" | "deleted";
  creatorId: string;
  creatorName: string | null;
  versions: number;
  updatedAt: string;
};

export type AiGameVersion = {
  version: number;
  prompt: string;
  title: string;
  emoji: string;
  rules: string | null;
  html: string;
  createdAt: string;
  /** 확정 전 자동 테스트 결과 (안 했으면 null) */
  test: { ok: boolean; problems: string[] } | null;
};

export type AiGameEdit = {
  id: number;
  roomCode: string;
  title: string;
  emoji: string;
  status: "draft" | "published" | "hidden" | "deleted";
  publishedVersion: number | null;
  versions: AiGameVersion[];
  /** AI가 만드는 중이면 그 요청 */
  pending: { prompt: string } | null;
  lastError: string | null;
  /** 내용 기준에 걸려 못 만들었을 때 AI가 제안한 대안 게임 */
  suggestions: string[];
  /** 이번 프롬프트에서 남은 자동 수정 횟수 */
  autofixLeft: number;
};

async function publishedCount(code: string) {
  const rows = (await getSql()`select count(*)::int as n from uk_ai_games where room_code = ${code} and status = 'published'`) as { n: number }[];
  return Number(rows[0]?.n ?? 0);
}

/** 이 방에서 내가 만들던 게임 (임시저장, 방마다 1개) */
export async function getMyDraft(code: string, me: string): Promise<{ id: number; versions: number } | null> {
  const rows = (await getSql()`
    select g.id, (select count(*)::int from uk_ai_game_versions v where v.ai_game_id = g.id) as versions
    from uk_ai_games g where g.room_code = ${code} and g.creator_kakao_id = ${me} and g.status = 'draft'
  `) as { id: number; versions: number }[];
  return rows[0] ? { id: Number(rows[0].id), versions: Number(rows[0].versions) } : null;
}

export type CreateAiGameResult =
  | { ok: true; id: number }
  | { ok: false; reason: "not_member" | "full" | "busy" }
  | { ok: false; reason: "draft_exists"; id: number };

/**
 * 새로 만들기. 임시저장은 방마다 한 사람에 1개라, 만들던 게임이 있으면 draft_exists 를 돌려준다.
 * replace 면 (사용자가 '이전 게임은 삭제됩니다'를 확인한 뒤) 만들던 게임을 지우고 새로 만든다.
 */
export async function createAiGame(code: string, me: string, opts: { replace?: boolean } = {}): Promise<CreateAiGameResult> {
  if (!(await isMember(code, me))) return { ok: false, reason: "not_member" };
  if ((await publishedCount(code)) >= AI_GAMES_PER_ROOM) return { ok: false, reason: "full" };
  const sql = getSql();
  const draft = await getMyDraft(code, me);
  if (draft) {
    if (!opts.replace) return { ok: false, reason: "draft_exists", id: draft.id };
    const removed = (await sql`
      delete from uk_ai_games where id = ${draft.id} and status = 'draft' and pending_prompt is null returning id
    `) as unknown[];
    if (removed.length === 0) return { ok: false, reason: "busy" };
  }
  const rows = (await sql`
    insert into uk_ai_games (room_code, creator_kakao_id) values (${code}, ${me})
    on conflict do nothing returning id
  `) as { id: number }[];
  if (rows[0]) return { ok: true, id: Number(rows[0].id) };
  const again = await getMyDraft(code, me);
  return again ? { ok: false, reason: "draft_exists", id: again.id } : { ok: false, reason: "busy" };
}

type GameRow = {
  id: number;
  room_code: string;
  creator_kakao_id: string;
  title: string;
  emoji: string;
  status: "draft" | "published" | "hidden" | "deleted";
  published_version: number | null;
  pending_prompt: string | null;
  pending_ledger_id: number | null;
  pending_since: string | null;
  last_error: string | null;
  last_suggestions: string[] | null;
  autofix_count: number;
  pending_fix: string[] | null;
};

export async function loadAiGame(id: number): Promise<GameRow | null> {
  const rows = (await getSql()`
    select id, room_code, creator_kakao_id, title, emoji, status, published_version,
           pending_prompt, pending_ledger_id, pending_since, last_error, last_suggestions,
           autofix_count, pending_fix
    from uk_ai_games where id = ${id}
  `) as GameRow[];
  return rows[0] ?? null;
}

/** 오래 멈춘 생성은 실패로 정리하고 환불 */
async function clearStalePending(g: GameRow) {
  if (!g.pending_since || Date.now() - new Date(g.pending_since).getTime() < PENDING_STALE_MS) return g;
  const cleared = (await getSql()`
    update uk_ai_games set pending_prompt = null, pending_ledger_id = null, pending_since = null,
      last_error = '시간이 너무 오래 걸려서 멈췄어요. 바나나는 돌려드렸어요.'
    where id = ${g.id} and pending_since = ${g.pending_since}
    returning id
  `) as unknown[];
  if (cleared.length && g.pending_ledger_id) await refundBananas(g.creator_kakao_id, Number(g.pending_ledger_id));
  return (await loadAiGame(g.id)) ?? g;
}

/** 만드는 중(임시저장)인 게임만, 만든 사람만 (그 방 멤버일 때). 확정한 게임은 더 고칠 수 없다 */
export async function getAiGameForEdit(id: number, me: string): Promise<AiGameEdit | null> {
  let g = await loadAiGame(id);
  if (!g || g.creator_kakao_id !== me || g.status !== "draft" || !(await isMember(g.room_code, me))) return null;
  g = await clearStalePending(g);
  const versions = (await getSql()`
    select version, prompt, title, emoji, rules, html, created_at, tested_ok, test_problems from uk_ai_game_versions
    where ai_game_id = ${id} order by version
  `) as {
    version: number;
    prompt: string;
    title: string;
    emoji: string;
    rules: string | null;
    html: string;
    created_at: string;
    tested_ok: boolean | null;
    test_problems: string[] | null;
  }[];
  return {
    id: Number(g.id),
    roomCode: g.room_code,
    title: g.title,
    emoji: g.emoji,
    status: g.status,
    publishedVersion: g.published_version === null ? null : Number(g.published_version),
    versions: versions.map((v) => ({
      version: Number(v.version),
      prompt: v.prompt,
      title: v.title,
      emoji: v.emoji,
      rules: v.rules,
      html: v.html,
      createdAt: new Date(v.created_at).toISOString(),
      test: v.tested_ok === null ? null : { ok: v.tested_ok, problems: v.test_problems ?? [] },
    })),
    pending: g.pending_prompt ? { prompt: g.pending_prompt } : null,
    lastError: g.last_error,
    suggestions: g.last_suggestions ?? [],
    autofixLeft: Math.max(0, AUTOFIX_MAX - Number(g.autofix_count ?? 0)),
  };
}

/** 방에서 할 수 있는 게임(확정된 것) + 내가 만드는 중인 게임 */
export async function listRoomAiGames(
  code: string,
  me: string,
): Promise<{ published: AiGameSummary[]; draft: AiGameSummary | null; limit: number } | null> {
  if (!(await isMember(code, me))) return null;
  const rows = (await getSql()`
    select g.id, g.title, g.emoji, g.status, g.creator_kakao_id, p.nickname, g.updated_at,
           (select count(*)::int from uk_ai_game_versions v where v.ai_game_id = g.id) as versions,
           (select v.rules from uk_ai_game_versions v where v.ai_game_id = g.id and v.version = g.published_version) as rules
    from uk_ai_games g left join players p on p.kakao_id = g.creator_kakao_id
    where g.room_code = ${code} and (g.status = 'published' or (g.status = 'draft' and g.creator_kakao_id = ${me}))
    order by g.updated_at desc, g.id desc
  `) as {
    id: number;
    title: string;
    emoji: string;
    status: "draft" | "published";
    creator_kakao_id: string;
    nickname: string | null;
    updated_at: string;
    versions: number;
    rules: string | null;
  }[];
  const all: AiGameSummary[] = rows.map((r) => ({
    id: Number(r.id),
    title: r.title,
    emoji: r.emoji,
    rules: r.rules,
    status: r.status,
    creatorId: r.creator_kakao_id,
    creatorName: r.nickname,
    versions: Number(r.versions),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
  return { published: all.filter((g) => g.status === "published"), draft: all.find((g) => g.status === "draft") ?? null, limit: AI_GAMES_PER_ROOM };
}

/** 확정 전 자동 테스트 결과 기록 (만든 사람의 화면에서 돌린 결과) */
export async function recordTestResult(id: number, me: string, version: number, result: { ok: boolean; problems: string[] }) {
  await getSql()`
    update uk_ai_game_versions v set tested_ok = ${result.ok}, test_problems = ${result.problems.slice(0, 10).map((p) => p.slice(0, 300))}
    from uk_ai_games g
    where v.ai_game_id = ${id} and v.version = ${version} and g.id = v.ai_game_id and g.creator_kakao_id = ${me} and g.status = 'draft'
  `;
}

/**
 * 확정: 자동 테스트를 통과한 버전만 방 사람들이 하는 게임이 된다.
 * 임시저장은 비고, 확정 뒤에는 고칠 수 없다. 방마다 최대 10개.
 */
export async function publishAiGame(id: number, me: string, version: number): Promise<{ ok: boolean; reason?: "full" | "untested" }> {
  const g = await loadAiGame(id);
  if (!g || g.status !== "draft" || g.creator_kakao_id !== me) return { ok: false };
  if ((await publishedCount(g.room_code)) >= AI_GAMES_PER_ROOM) return { ok: false, reason: "full" };
  const tested = (await getSql()`
    select tested_ok, html from uk_ai_game_versions where ai_game_id = ${id} and version = ${version}
  `) as { tested_ok: boolean | null; html: string }[];
  // 서버에서도 다시 확인: 테스트 통과 기록 + 정적 검사
  if (!tested[0] || tested[0].tested_ok !== true || validateGameHtml(tested[0].html).length) return { ok: false, reason: "untested" };
  const rows = (await getSql()`
    update uk_ai_games g set status = 'published', published_version = v.version, title = v.title, emoji = v.emoji, updated_at = now()
    from uk_ai_game_versions v
    where g.id = ${id} and g.creator_kakao_id = ${me} and g.status = 'draft' and g.pending_prompt is null
      and v.ai_game_id = g.id and v.version = ${version} and v.tested_ok = true
      and exists (select 1 from uk_room_members m where m.room_code = g.room_code and m.kakao_id = ${me})
      and (select count(*) from uk_ai_games o where o.room_code = g.room_code and o.status = 'published') < ${AI_GAMES_PER_ROOM}
    returning g.id
  `) as unknown[];
  return { ok: rows.length > 0 };
}

/** 관리자: 신고된 게임 숨기기 (방 목록·새 판에서 빠진다) */
export async function hideAiGame(id: number) {
  await getSql()`update uk_ai_games set status = 'hidden', updated_at = now() where id = ${id}`;
}

/**
 * 만든 사람만 지운다. 만들던 게임은 통째로 지우고, 확정한 게임은 목록·새 판에서만 빠진다 (지난 게임 기록은 남는다).
 * AI가 만드는 중이면 못 지운다.
 */
export async function deleteAiGame(id: number, me: string): Promise<{ ok: boolean }> {
  const sql = getSql();
  const draft = (await sql`
    delete from uk_ai_games where id = ${id} and creator_kakao_id = ${me} and status = 'draft' and pending_prompt is null returning id
  `) as unknown[];
  if (draft.length) return { ok: true };
  const pub = (await sql`
    update uk_ai_games set status = 'deleted', updated_at = now()
    where id = ${id} and creator_kakao_id = ${me} and status = 'published' returning id
  `) as unknown[];
  return { ok: pub.length > 0 };
}
