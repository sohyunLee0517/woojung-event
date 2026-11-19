import { describe, expect, it } from "vitest";
import { clampCut, judgeSnack } from "./logic";

// 과자 나눠먹기 규칙: 과자 하나(100)를 각자 몰래 한 번 잘라 간다. 합이 100을 넘으면 실패, 아니면 합계가 팀 점수.
describe("과자 나눠먹기 규칙", () => {
  it("자른 양은 1 ~ 100 정수", () => {
    expect(clampCut(0)).toBe(1);
    expect(clampCut(37.6)).toBe(38);
    expect(clampCut(140)).toBe(100);
    expect(clampCut(Number.NaN)).toBe(1);
  });

  it("모두 자르기 전엔 결과 없음", () => {
    expect(judgeSnack([30, null])).toBeNull();
  });

  it("합이 100 이하면 성공, 합계가 팀 점수", () => {
    expect(judgeSnack([30, 40, 25])).toEqual({ status: "success", total: 95 });
    expect(judgeSnack([50, 50])).toEqual({ status: "success", total: 100 });
  });

  it("합이 100을 넘으면 실패", () => {
    expect(judgeSnack([50, 51])).toEqual({ status: "fail", total: 101 });
  });
});
