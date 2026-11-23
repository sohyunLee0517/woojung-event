// 과자 나눠먹기 규칙 (순수 함수)
//   과자 하나를 100으로 보고, 각자 다른 사람 몫을 모른 채 한 번만 잘라 간다 (1~100).
//   모두 자르면 공개: 합이 100을 넘으면 과자가 부서져 실패, 100 이하면 합계가 팀 점수.

export const SNACK_TOTAL = 100;

export function clampCut(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(SNACK_TOTAL, Math.max(1, Math.round(n)));
}

export type SnackResult = { status: "success" | "fail"; total: number };

/** 아직 안 자른 사람이 있으면 null */
export function judgeSnack(cuts: (number | null)[]): SnackResult | null {
  if (cuts.length === 0 || cuts.some((c) => c === null)) return null;
  const total = (cuts as number[]).reduce((a, b) => a + b, 0);
  return { status: total > SNACK_TOTAL ? "fail" : "success", total };
}

/** 시작한 뒤 자를 수 있는 시간. 지나면 안 자른 사람은 0으로 치고 결과를 낸다 */
export const SNACK_CUT_LIMIT_MS = 60_000;

/** 제한 시간이 지났을 때의 결과: 안 자른 사람(null)은 0. 아무도 안 잘랐으면 0점 */
export function judgeSnackTimeout(cuts: (number | null)[]): SnackResult {
  const total = cuts.reduce<number>((a, b) => a + (b ?? 0), 0);
  return { status: total > SNACK_TOTAL ? "fail" : "success", total };
}

export function snackCutOver(startedAt: number | null, now: number): boolean {
  return startedAt !== null && now - startedAt >= SNACK_CUT_LIMIT_MS;
}
