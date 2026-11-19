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
