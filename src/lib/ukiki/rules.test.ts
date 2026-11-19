import { describe, expect, it } from "vitest";
import {
  fanfareCreateOutcome,
  hashRoomPassword,
  roomEntry,
  validateRoomInput,
  verifyRoomPassword,
} from "./rules";

describe("validateRoomInput", () => {
  it("공개방은 이름만 있으면 되고 비밀번호는 버린다", () => {
    expect(validateRoomInput({ name: "  우리끼리  ", visibility: "public", password: "1234" })).toEqual({
      ok: true,
      value: { name: "우리끼리", visibility: "public", password: null },
    });
  });

  it("비밀방은 비밀번호 4~20자가 필요하다", () => {
    expect(validateRoomInput({ name: "비밀", visibility: "private", password: "" })).toEqual({
      ok: false,
      error: "비밀번호를 4~20자로 정해 주세요",
    });
    expect(validateRoomInput({ name: "비밀", visibility: "private", password: "123" }).ok).toBe(false);
    expect(validateRoomInput({ name: "비밀", visibility: "private", password: "1234" })).toEqual({
      ok: true,
      value: { name: "비밀", visibility: "private", password: "1234" },
    });
  });

  it("방 이름은 1~20자", () => {
    expect(validateRoomInput({ name: "   ", visibility: "public" })).toEqual({ ok: false, error: "방 이름을 정해 주세요" });
    expect(validateRoomInput({ name: "가".repeat(21), visibility: "public" })).toEqual({
      ok: false,
      error: "방 이름은 20자까지예요",
    });
  });

  it("공개/비공개 말고 다른 값은 거절", () => {
    expect(validateRoomInput({ name: "방", visibility: "secret" }).ok).toBe(false);
  });
});

describe("방 비밀번호", () => {
  it("원래 비밀번호를 그대로 저장하지 않는다", () => {
    const stored = hashRoomPassword("1234");
    expect(stored).not.toContain("1234");
    expect(stored.startsWith("scrypt$")).toBe(true);
  });

  it("같은 비밀번호도 매번 다르게 저장된다 (소금값)", () => {
    expect(hashRoomPassword("1234")).not.toBe(hashRoomPassword("1234"));
  });

  it("맞는 비밀번호만 통과", () => {
    const stored = hashRoomPassword("우끼끼1234");
    expect(verifyRoomPassword("우끼끼1234", stored)).toBe(true);
    expect(verifyRoomPassword("우끼끼123", stored)).toBe(false);
    expect(verifyRoomPassword("", stored)).toBe(false);
    expect(verifyRoomPassword("1234", null)).toBe(false);
    expect(verifyRoomPassword("1234", "망가진값")).toBe(false);
  });
});

describe("roomEntry", () => {
  const hash = hashRoomPassword("1234");

  it("공개방은 바로 들어간다", () => {
    expect(roomEntry({ visibility: "public", passwordHash: null, isMember: false })).toBe("enter");
  });

  it("비밀방에 처음 오면 비밀번호를 묻는다", () => {
    expect(roomEntry({ visibility: "private", passwordHash: hash, isMember: false })).toBe("need_password");
  });

  it("비밀번호가 맞으면 들어가고, 틀리면 다시 묻는다", () => {
    expect(roomEntry({ visibility: "private", passwordHash: hash, isMember: false, password: "1234" })).toBe("enter");
    expect(roomEntry({ visibility: "private", passwordHash: hash, isMember: false, password: "0000" })).toBe(
      "wrong_password",
    );
  });

  it("한 번 들어온 멤버는 다시 묻지 않는다", () => {
    expect(roomEntry({ visibility: "private", passwordHash: hash, isMember: true })).toBe("enter");
  });
});

describe("fanfareCreateOutcome (방당 진행 중인 빵빠레는 1개)", () => {
  it("내가 먼저 저장했으면 내가 호스트인 빵빠레가 만들어진다", () => {
    expect(fanfareCreateOutcome({ createdId: 7, active: null })).toEqual({ kind: "created", id: 7 });
  });

  it("다른 사람이 먼저 만들었으면 나가기/그 빵빠레 참여하기를 고르게 한다", () => {
    expect(
      fanfareCreateOutcome({ createdId: null, active: { id: 3, hostKakaoId: "a", hostName: "소현" } }),
    ).toEqual({
      kind: "conflict",
      active: { id: 3, hostKakaoId: "a", hostName: "소현" },
      message: "소현님이 먼저 우정의 온도를 열었어요",
      choices: ["leave", "join"],
    });
  });

  it("저장은 실패했는데 진행 중인 빵빠레도 없으면(그새 끝남) 다시 시도하게 한다", () => {
    expect(fanfareCreateOutcome({ createdId: null, active: null })).toEqual({ kind: "retry" });
  });
});
