import { describe, expect, it } from "vitest";
import { ROOM_PAGE_SIZE, pageResult, parseRoomQuery } from "./room-list";

describe("parseRoomQuery", () => {
  it("한 번에 20개씩 보여 준다", () => {
    expect(ROOM_PAGE_SIZE).toBe(20);
    expect(parseRoomQuery({})).toEqual({ q: "", offset: 0, limit: 20 });
  });

  it("검색어는 앞뒤 공백을 지우고 20자까지만", () => {
    expect(parseRoomQuery({ q: "  생일  " }).q).toBe("생일");
    expect(parseRoomQuery({ q: "가".repeat(30) }).q).toBe("가".repeat(20));
  });

  it("검색어의 % _ 는 글자 그대로 찾는다 (전부 검색되지 않게)", () => {
    expect(parseRoomQuery({ q: "100%" }).q).toBe("100%");
    expect(parseRoomQuery({ q: "100%" })).toMatchObject({ q: "100%" });
  });

  it("더보기 위치(offset)는 0 이상의 20 단위 숫자만", () => {
    expect(parseRoomQuery({ offset: "20" }).offset).toBe(20);
    expect(parseRoomQuery({ offset: "-5" }).offset).toBe(0);
    expect(parseRoomQuery({ offset: "abc" }).offset).toBe(0);
    expect(parseRoomQuery({ offset: "7" }).offset).toBe(0);
    expect(parseRoomQuery({ offset: "100000" }).offset).toBe(1000);
  });
});

describe("pageResult (더보기)", () => {
  it("21개를 받아 왔으면 20개만 보여 주고 더보기가 있다", () => {
    const rows = Array.from({ length: 21 }, (_, i) => i);
    expect(pageResult(rows, 0)).toEqual({ items: rows.slice(0, 20), hasMore: true, nextOffset: 20 });
  });

  it("20개 이하면 더보기가 없다", () => {
    expect(pageResult([1, 2, 3], 20)).toEqual({ items: [1, 2, 3], hasMore: false, nextOffset: null });
  });
});

describe("likePattern", () => {
  it("LIKE 특수문자를 이스케이프해서 감싼다", async () => {
    const { likePattern } = await import("./room-list");
    expect(likePattern("생일")).toBe("%생일%");
    expect(likePattern("100%_\\")).toBe("%100\\%\\_\\\\%");
  });
});
