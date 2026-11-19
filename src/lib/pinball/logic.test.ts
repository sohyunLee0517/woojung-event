import { describe, expect, it } from "vitest";
import { simulateOrder } from "./logic";

const P = ["a", "b", "c", "d", "e"];

describe("핀볼 순서", () => {
  it("같은 시드면 몇 번을 돌려도 같은 순서", () => {
    expect(simulateOrder(P, 1234)).toEqual(simulateOrder(P, 1234));
  });
  it("모든 사람이 한 번씩 순위에 들어간다", () => {
    const order = simulateOrder(P, 99);
    expect([...order].sort()).toEqual([...P].sort());
  });
  it("시드가 다르면 1등이 바뀌기도 한다", () => {
    const firsts = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => simulateOrder(P, s)[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });
});
