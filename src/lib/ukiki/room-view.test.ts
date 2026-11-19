import { describe, expect, it } from "vitest";
import { MIN_PLAYERS, roomSections } from "./room-view";

describe("roomSections (방 화면에 무엇을 보여 줄지)", () => {
  it("모든 게임은 2명부터", () => {
    expect(MIN_PLAYERS).toBe(2);
  });

  it("혼자면 게임 대신 친구 초대하기", () => {
    expect(roomSections({ memberCount: 1, activeGames: 0 })).toEqual({ invite: true, games: false, active: false });
  });

  it("2명 이상이면 진행 중·새 게임 열기", () => {
    expect(roomSections({ memberCount: 2, activeGames: 1 })).toEqual({ invite: false, games: true, active: true });
    expect(roomSections({ memberCount: 7, activeGames: 3 })).toEqual({ invite: false, games: true, active: true });
  });

  it("진행 중인 게임이 없으면 진행 중 영역은 숨긴다 (새 게임 버튼은 그대로)", () => {
    expect(roomSections({ memberCount: 2, activeGames: 0 })).toEqual({ invite: false, games: true, active: false });
  });

  it("혼자면 진행 중 게임이 있어도 진행 중 영역은 숨긴다", () => {
    expect(roomSections({ memberCount: 1, activeGames: 2 })).toEqual({ invite: true, games: false, active: false });
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
