import { describe, expect, it } from "vitest";
import { BANANAS_PER_PLAY, BANANAS_PER_WIN, PROMPT_COST, canAffordPrompt, gameRewards } from "./rules";

describe("바나나 규칙", () => {
  it("게임 한 판 = 1개, 1등·팀 성공 = 2개 더, 프롬프트 1번 = 10개", () => {
    expect(BANANAS_PER_PLAY).toBe(1);
    expect(BANANAS_PER_WIN).toBe(2);
    expect(PROMPT_COST).toBe(10);
  });

  it("참여만 하면 참여 바나나 1개", () => {
    expect(gameRewards(false)).toEqual([{ reason: "play", delta: 1 }]);
  });

  it("이기면 참여 1개 + 승리 2개", () => {
    expect(gameRewards(true)).toEqual([
      { reason: "play", delta: 1 },
      { reason: "win", delta: 2 },
    ]);
  });

  it("바나나 10개가 있어야 프롬프트를 쓸 수 있다", () => {
    expect(canAffordPrompt(9)).toBe(false);
    expect(canAffordPrompt(10)).toBe(true);
  });
});
