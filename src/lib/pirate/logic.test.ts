import { describe, expect, it } from "vitest";
import { HOLES, judgeStab, pickTrap, turnOf } from "./logic";

// 해적 무찌르기 규칙 (순수 함수)
//   입장 순서대로 돌아가며 구멍에 칼을 꽂는다. 숨은 함정 구멍에 꽂으면 해적이 튀어나와 실패.
//   함정 구멍 하나만 남을 때까지(= 칼 하나가 남을 때까지) 안 튀어나오면 모두 성공.
describe("해적 무찌르기 규칙", () => {
  it("함정 구멍은 0 ~ HOLES-1 중 하나", () => {
    expect(pickTrap(() => 0)).toBe(0);
    expect(pickTrap(() => 0.9999)).toBe(HOLES - 1);
  });

  it("입장 순서대로 차례가 돈다", () => {
    const order = ["a", "b", "c"];
    expect(turnOf(order, 0)).toBe("a");
    expect(turnOf(order, 1)).toBe("b");
    expect(turnOf(order, 3)).toBe("a");
    expect(turnOf([], 0)).toBeNull();
  });

  it("함정에 꽂으면 실패, 함정만 남으면 성공, 아니면 계속", () => {
    expect(judgeStab({ hole: 5, trap: 5, stabbedBefore: 0 })).toBe("fail");
    expect(judgeStab({ hole: 4, trap: 5, stabbedBefore: 0 })).toBe("continue");
    // 이번이 HOLES-1 번째 칼이면 남은 구멍은 함정 하나뿐 → 성공
    expect(judgeStab({ hole: 4, trap: 5, stabbedBefore: HOLES - 2 })).toBe("success");
  });
});
