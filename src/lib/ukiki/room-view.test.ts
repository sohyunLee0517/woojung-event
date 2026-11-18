import { describe, expect, it } from "vitest";
import { MIN_PLAYERS, roomSections } from "./room-view";

describe("roomSections (방 화면에 무엇을 보여 줄지)", () => {
  it("모든 게임은 2명부터", () => {
    expect(MIN_PLAYERS).toBe(2);
  });

  it("혼자면 게임 대신 친구 초대하기", () => {
    expect(roomSections({ memberCount: 1 })).toEqual({ invite: true, games: false });
  });

  it("2명 이상이면 진행 중·새 게임 열기", () => {
    expect(roomSections({ memberCount: 2 })).toEqual({ invite: false, games: true });
    expect(roomSections({ memberCount: 7 })).toEqual({ invite: false, games: true });
  });
});

describe("joinedMembers (새로 들어온 친구 찾기)", () => {
  it("이전에 없던 사람만 돌려준다", async () => {
    const { joinedMembers } = await import("./room-view");
    expect(joinedMembers(["me"], [{ kakaoId: "me", nickname: "나" }, { kakaoId: "f", nickname: "친구" }])).toEqual([
      { kakaoId: "f", nickname: "친구" },
    ]);
  });

  it("처음 불러올 때(이전 목록 없음)는 아무도 새로 들어온 게 아니다", async () => {
    const { joinedMembers } = await import("./room-view");
    expect(joinedMembers(null, [{ kakaoId: "me", nickname: "나" }])).toEqual([]);
  });
});
