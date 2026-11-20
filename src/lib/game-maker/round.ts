// AI 게임 한 판의 결과 규칙 (순수 함수)
import type { KitEndResult } from "./kit";

/** 시작하고 이만큼 지나도 안 끝나면 승자 없이 끝난 것으로 본다 */
export const AI_ROUND_MAX_MS = 15 * 60_000;

/** 승자는 참여자 안에서만, 중복 없이. 팀 성공이면 모두가 이긴 것이라 승자 목록은 비운다 */
export function normalizeEnd(result: KitEndResult, members: string[]): KitEndResult {
  if (result.teamSuccess) return { winners: [], teamSuccess: true };
  const winners = [...new Set(result.winners.filter((w) => members.includes(w)))];
  return { winners, teamSuccess: false };
}

/** 모두 점수를 냈으면 최고점(공동 1등 포함), 아직이면 null */
export function winnersFromScores(scores: Record<string, number | null>, members: string[]): string[] | null {
  if (members.length === 0 || members.some((m) => scores[m] === null || scores[m] === undefined)) return null;
  const top = Math.max(...members.map((m) => scores[m] as number));
  return members.filter((m) => scores[m] === top);
}

export function roundPhaseEnded(r: { startedAt: number | null; endedAt: number | null }, now: number): boolean {
  if (r.endedAt !== null) return true;
  return r.startedAt !== null && now - r.startedAt > AI_ROUND_MAX_MS;
}
