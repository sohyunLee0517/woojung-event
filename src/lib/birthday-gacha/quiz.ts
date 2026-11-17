import { randomInt } from "node:crypto";
import { getSql } from "@/lib/db";
import { QUIZZES, findQuiz, publicQuiz } from "@/lib/birthday-gacha/quizzes";
import { CARD_TYPES, quizWindow, type CardType } from "@/lib/birthday-gacha/rules";

export type QuizStatus = {
  /** 지금 퀴즈를 풀 수 있는지 */
  eligible: boolean;
  windowStart: string;
  windowEnd: string;
  /** 다음에 풀 수 있는 시각 (지금 풀 수 있으면 null) */
  nextAvailableAt: string | null;
  lastParticipatedAt: string | null;
  /** 이번 구간에 이미 받아 둔 문제가 있으면 true (새로고침해도 같은 문제) */
  hasOpenQuestion: boolean;
};

async function isMember(code: string, kakaoId: string) {
  const sql = getSql();
  const rows = (await sql`
    select 1 from game_players where game_code = ${code} and kakao_id = ${kakaoId}
  `) as unknown[];
  return rows.length > 0;
}

export async function getQuizStatus(code: string, kakaoId: string, nowMs = Date.now()): Promise<QuizStatus | null> {
  const sql = getSql();
  if (!(await isMember(code, kakaoId))) return null;
  const win = quizWindow(nowMs);
  const windowStart = new Date(win.start).toISOString();

  const rows = (await sql`
    select window_start, answered_at from quiz_attempts
    where game_code = ${code} and kakao_id = ${kakaoId}
    order by issued_at desc
  `) as { window_start: string; answered_at: string | null }[];

  const current = rows.find((r) => new Date(r.window_start).getTime() === win.start);
  const answeredThisWindow = !!current?.answered_at;
  const last = rows.find((r) => r.answered_at)?.answered_at ?? null;
  const eligible = !answeredThisWindow;

  return {
    eligible,
    windowStart,
    windowEnd: new Date(win.end).toISOString(),
    nextAvailableAt: eligible ? null : new Date(win.end).toISOString(),
    lastParticipatedAt: last ? new Date(last).toISOString() : null,
    hasOpenQuestion: !!current && !current.answered_at,
  };
}

export type StartResult =
  | { ok: true; quiz: ReturnType<typeof publicQuiz> }
  | { ok: false; reason: "not_member" | "already" };

/** 이번 구간 문제를 꺼낸다. 이미 받아 둔 문제가 있으면 같은 문제를 돌려준다. */
export async function startQuiz(code: string, kakaoId: string): Promise<StartResult> {
  const sql = getSql();
  const status = await getQuizStatus(code, kakaoId);
  if (!status) return { ok: false, reason: "not_member" };
  if (!status.eligible) return { ok: false, reason: "already" };

  // 이 게임에서 아직 안 받은 문제 중에서 고른다
  const used = (await sql`
    select question_id from quiz_attempts where game_code = ${code} and kakao_id = ${kakaoId}
  `) as { question_id: string }[];
  const usedIds = new Set(used.map((u) => u.question_id));
  const pool = QUIZZES.filter((q) => !usedIds.has(q.id));
  const pick = (pool.length > 0 ? pool : QUIZZES)[randomInt((pool.length > 0 ? pool : QUIZZES).length)];

  // 이미 받아 둔 문제가 있으면 그대로 두고, 없을 때만 새로 저장
  await sql`
    insert into quiz_attempts (game_code, kakao_id, window_start, question_id)
    values (${code}, ${kakaoId}, ${status.windowStart}, ${pick.id})
    on conflict (game_code, kakao_id, window_start) do nothing
  `;
  const row = (await sql`
    select question_id from quiz_attempts
    where game_code = ${code} and kakao_id = ${kakaoId} and window_start = ${status.windowStart}
  `) as { question_id: string }[];
  const quiz = findQuiz(row[0].question_id) ?? pick;
  return { ok: true, quiz: publicQuiz(quiz) };
}

export type AnswerResult =
  | { ok: true; correct: boolean; answer: number; card: CardType | null }
  | { ok: false; reason: "no_question" | "already" };

/** 답을 제출한다. 맞으면 특수카드 1장을 무작위로 받는다. 틀려도 이번 구간 참여로 기록된다. */
export async function answerQuiz(code: string, kakaoId: string, choice: number): Promise<AnswerResult> {
  const sql = getSql();
  const win = quizWindow(Date.now());
  const windowStart = new Date(win.start).toISOString();

  const issued = (await sql`
    select question_id, answered_at from quiz_attempts
    where game_code = ${code} and kakao_id = ${kakaoId} and window_start = ${windowStart}
  `) as { question_id: string; answered_at: string | null }[];
  if (issued.length === 0) return { ok: false, reason: "no_question" };
  if (issued[0].answered_at) return { ok: false, reason: "already" };

  const quiz = findQuiz(issued[0].question_id);
  if (!quiz) return { ok: false, reason: "no_question" };
  const correct = choice === quiz.answer;

  const updated = (await sql`
    update quiz_attempts set choice = ${choice}, correct = ${correct}, answered_at = now()
    where game_code = ${code} and kakao_id = ${kakaoId} and window_start = ${windowStart}
      and answered_at is null
    returning question_id
  `) as unknown[];
  if (updated.length === 0) return { ok: false, reason: "already" };

  let card: CardType | null = null;
  if (correct) {
    card = CARD_TYPES[randomInt(CARD_TYPES.length)];
    await sql`
      insert into player_cards (game_code, kakao_id, card_type)
      values (${code}, ${kakaoId}, ${card})
    `;
  }
  return { ok: true, correct, answer: quiz.answer, card };
}
