import { describe, expect, it } from "vitest";
import { gachaRanking, isGachaFinished } from "./results";

describe("isGachaFinished", () => {
  it("캡슐을 다 뽑으면 끝난 게임", () => {
    expect(isGachaFinished({ total: 9, drawn: 9 })).toBe(true);
    expect(isGachaFinished({ total: 9, drawn: 8 })).toBe(false);
    expect(isGachaFinished({ total: 0, drawn: 0 })).toBe(false);
  });
});

describe("gachaRanking (가챠 결과)", () => {
  it("금액이 큰 순, 같으면 시간이 긴 순으로 등수를 매긴다", () => {
    const ranked = gachaRanking([
      { kakaoId: "a", nickname: "소현", money: 11000, minutes: 9 },
      { kakaoId: "b", nickname: "영한", money: 12500, minutes: 6 },
      { kakaoId: "c", nickname: "친구", money: 11000, minutes: 12 },
    ]);
    expect(ranked.map((r) => [r.rank, r.kakaoId])).toEqual([
      [1, "b"],
      [2, "c"],
      [3, "a"],
    ]);
  });

  it("금액과 시간이 같으면 공동 등수", () => {
    const ranked = gachaRanking([
      { kakaoId: "a", nickname: "A", money: 10000, minutes: 10 },
      { kakaoId: "b", nickname: "B", money: 10000, minutes: 10 },
      { kakaoId: "c", nickname: "C", money: 9000, minutes: 10 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("1등에게 왕관 표시", () => {
    const ranked = gachaRanking([
      { kakaoId: "a", nickname: "A", money: 10000, minutes: 10 },
      { kakaoId: "b", nickname: "B", money: 9000, minutes: 10 },
    ]);
    expect(ranked[0].badge).toBe("👑");
    expect(ranked[1].badge).toBe("");
  });
});
