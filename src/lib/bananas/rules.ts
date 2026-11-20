// 바나나 규칙 (순수 함수). 게임을 하면 바나나가 쌓이고, 바나나로 AI 게임 만들기 프롬프트를 돌린다.

/** 게임 한 판에 참여하면 */
export const BANANAS_PER_PLAY = 1;
/** 1등이거나 팀 전체가 성공하면 (참여 바나나에 더해서) */
export const BANANAS_PER_WIN = 2;
/** AI 게임 만들기·수정 프롬프트 1번 */
export const PROMPT_COST = 10;
/** 이 시각 뒤에 끝난 게임부터 바나나를 준다 (기능을 연 날) */
export const BANANA_START = "2026-11-20T00:00:00+09:00";

export type BananaReason = "play" | "win" | "prompt" | "refund" | "grant";

export function gameRewards(won: boolean): { reason: "play" | "win"; delta: number }[] {
  const out: { reason: "play" | "win"; delta: number }[] = [{ reason: "play", delta: BANANAS_PER_PLAY }];
  if (won) out.push({ reason: "win", delta: BANANAS_PER_WIN });
  return out;
}

export function canAffordPrompt(balance: number): boolean {
  return balance >= PROMPT_COST;
}
