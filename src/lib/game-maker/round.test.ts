import { describe, expect, it } from "vitest";
import { normalizeEnd, roundPhaseEnded, winnersFromScores, AI_ROUND_MAX_MS } from "./round";

describe("AI 게임 한 판 결과", () => {
  const members = ["a", "b", "c"];

  it("승자는 참여자 안에서만, 중복 없이", () => {
    expect(normalizeEnd({ winners: ["a", "x", "a"], teamSuccess: false }, members)).toEqual({ winners: ["a"], teamSuccess: false });
  });

  it("팀 성공이면 승자 목록은 비운다 (모두가 이긴 것)", () => {
    expect(normalizeEnd({ winners: ["a"], teamSuccess: true }, members)).toEqual({ winners: [], teamSuccess: true });
  });

  it("점수는 모두 낸 뒤에야 승자가 정해진다 (최고점 공동 1등)", () => {
    expect(winnersFromScores({ a: 3, b: null, c: 1 }, members)).toBeNull();
    expect(winnersFromScores({ a: 3, b: 5, c: 5 }, members)).toEqual(["b", "c"]);
  });

  it("시작하고 너무 오래(15분) 안 끝나면 승자 없이 끝난 것으로 본다", () => {
    expect(AI_ROUND_MAX_MS).toBe(15 * 60_000);
    expect(roundPhaseEnded({ startedAt: 0, endedAt: null }, AI_ROUND_MAX_MS - 1)).toBe(false);
    expect(roundPhaseEnded({ startedAt: 0, endedAt: null }, AI_ROUND_MAX_MS + 1)).toBe(true);
    expect(roundPhaseEnded({ startedAt: 0, endedAt: 10 }, 11)).toBe(true);
  });
});
