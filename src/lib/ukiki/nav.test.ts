import { describe, expect, it } from "vitest";
import { safeNextPath } from "./nav";

describe("safeNextPath (로그인 후 돌아갈 곳)", () => {
  it("우끼끼 방·가챠·관리자 주소면 그리로 보낸다", () => {
    expect(safeNextPath("/r/ABC234")).toBe("/r/ABC234");
    expect(safeNextPath("/r/ABC234/fanfare/12")).toBe("/r/ABC234/fanfare/12");
    expect(safeNextPath("/r/ABC234/map")).toBe("/r/ABC234/map");
    expect(safeNextPath("/birthday-gacha/g/TR8S4G")).toBe("/birthday-gacha/g/TR8S4G");
    expect(safeNextPath("/birthday-gacha/admin")).toBe("/birthday-gacha/admin");
  });

  it("없거나 사이트 밖·이상한 주소면 로비로", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("https://evil.example.com")).toBe("/");
    expect(safeNextPath("//evil.example.com/r/ABC234")).toBe("/");
    expect(safeNextPath("/r/../../etc")).toBe("/");
    expect(safeNextPath("/api/auth/signout")).toBe("/");
  });
});
