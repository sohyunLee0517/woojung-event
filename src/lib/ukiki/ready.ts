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

// ── 대기실 ──
// 게임을 열면: 방 인원 전원이 준비완료하면 바로 시작.
// 아니면 제한 시간까지 기다렸다가 그때 준비완료한 사람(2명 이상)끼리 시작. 2명이 안 되면 노게임(취소).

/** 게임을 연 뒤 기다리는 시간 */
export const WAIT_LIMIT_MS = 120_000;
export const MIN_GAME_PLAYERS = 2;

export type WaitOutcome = "start" | "wait" | "cancel";

/** ready: 준비완료한 사람 수, roomSize: 방 인원 */
export function waitOutcome(input: { roomSize: number; ready: number; openedAt: number; now: number }): WaitOutcome {
  const enough = input.ready >= MIN_GAME_PLAYERS;
  if (enough && input.ready >= input.roomSize) return "start";
  if (input.now - input.openedAt < WAIT_LIMIT_MS) return "wait";
  return enough ? "start" : "cancel";
}

/** 제한 시간까지 남은 초 (올림). 지났거나 모르면 0 */
export function waitLeftSeconds(waitUntil: number | null, now: number): number {
  if (waitUntil === null || now >= waitUntil) return 0;
  return Math.ceil((waitUntil - now) / 1000);
}
