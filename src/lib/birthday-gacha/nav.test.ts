import { describe, expect, it } from "vitest";
import { mapBack, mapHref } from "./nav";

describe("mapHref", () => {
  it("방에서 지도를 열면 돌아올 방 주소를 같이 넘긴다", () => {
    expect(mapHref("/birthday-gacha/g/TR8S4G")).toBe("/birthday-gacha/map?from=%2Fbirthday-gacha%2Fg%2FTR8S4G");
  });

  it("홈에서 열면 그냥 지도", () => {
    expect(mapHref()).toBe("/birthday-gacha/map");
  });
});

describe("mapBack", () => {
  it("방에서 왔으면 그 방으로 돌아간다", () => {
    expect(mapBack("/birthday-gacha/g/TR8S4G")).toEqual({ href: "/birthday-gacha/g/TR8S4G", label: "← 방으로" });
  });

  it("어디서 왔는지 모르면 홈으로", () => {
    expect(mapBack(undefined)).toEqual({ href: "/birthday-gacha", label: "← 홈" });
  });

  it("사이트 밖이나 이상한 주소로는 보내지 않는다", () => {
    expect(mapBack("https://evil.example.com")).toEqual({ href: "/birthday-gacha", label: "← 홈" });
    expect(mapBack("//evil.example.com/birthday-gacha/g/AAAAAA")).toEqual({ href: "/birthday-gacha", label: "← 홈" });
    expect(mapBack("/birthday-gacha/g/TR8S4G/../../admin")).toEqual({ href: "/birthday-gacha", label: "← 홈" });
  });
});
