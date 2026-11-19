// 모든 게임 공통 흐름: 모두 '준비완료' → 3·2·1 카운트다운 → 시작!
// 시작 시각(startedAt)을 지금+3초로 저장해 두면, 모두의 화면이 같은 시각 기준으로 숫자를 센다.

export const COUNTDOWN_MS = 3000;
export const GO_BURST_MS = 900;

export type ReadyPhase = "WAITING" | "COUNTDOWN" | "STARTED";

/** 들어온 사람이 2명 이상이고 모두 준비완료인지 */
export function everyoneReady(players: { ready?: boolean }[]): boolean {
  return players.length >= 2 && players.every((p) => p.ready === true);
}

export function readyPhase(startedAt: number | null, now: number): ReadyPhase {
  if (startedAt === null) return "WAITING";
  return now < startedAt ? "COUNTDOWN" : "STARTED";
}

/** 카운트다운 숫자 (3·2·1). 시작 전이 아니면 0 */
export function countdownLeft(startedAt: number | null, now: number): number {
  if (startedAt === null || now >= startedAt) return 0;
  return Math.ceil((startedAt - now) / 1000);
}

/** 막 시작했을 때 '시작!' 연출을 보여 줄지 */
export function showGoBurst(startedAt: number | null, now: number): boolean {
  return startedAt !== null && now >= startedAt && now - startedAt < GO_BURST_MS;
}
