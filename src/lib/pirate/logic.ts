// 해적 무찌르기 규칙 (순수 함수). DB 쓰기는 src/lib/pirate/store.ts 가 이 함수로 판정한다.

/** 통에 뚫린 구멍 수 */
export const HOLES = 16;

export type StabOutcome = "continue" | "fail" | "success";
export type PirateStatus = "waiting" | "playing" | "fail" | "success";

/** 함정 구멍 고르기 (rand: 0 이상 1 미만) */
export function pickTrap(rand: () => number = Math.random): number {
  return Math.min(HOLES - 1, Math.floor(rand() * HOLES));
}

/** stabCount 번째(0부터) 칼을 꽂을 사람. 입장 순서대로 돈다 */
export function turnOf(order: string[], stabCount: number): string | null {
  if (order.length === 0) return null;
  return order[stabCount % order.length];
}

/** 칼 하나를 꽂았을 때 결과 */
export function judgeStab(input: { hole: number; trap: number; stabbedBefore: number }): StabOutcome {
  if (input.hole === input.trap) return "fail";
  if (input.stabbedBefore + 1 >= HOLES - 1) return "success";
  return "continue";
}

/** 내 차례에 주어지는 시간. 지나면 남은 구멍 중 하나에 자동으로 꽂힌다 */
export const TURN_LIMIT_MS = 20_000;

/** 지금 차례가 끝나는 시각: 게임 시작(또는 앞사람이 꽂은) 시각 + 20초 */
export function turnDeadline(startedAt: number, lastStabAt: number | null): number {
  return Math.max(startedAt, lastStabAt ?? 0) + TURN_LIMIT_MS;
}

/** 아직 안 꽂힌 구멍 중 하나 (함정일 수도 있다) */
export function pickAutoHole(taken: number[], rand: () => number = Math.random): number {
  const free = Array.from({ length: HOLES }, (_, h) => h).filter((h) => !taken.includes(h));
  return free[Math.min(free.length - 1, Math.floor(rand() * free.length))];
}
