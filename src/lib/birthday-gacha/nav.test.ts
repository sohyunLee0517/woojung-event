import { describe, expect, it } from "vitest";
import { roomMapHref } from "./nav";

describe("roomMapHref (지도는 방 안에 있다)", () => {
  it("방 지도 주소", () => {
    expect(roomMapHref("TR8S4G")).toBe("/r/TR8S4G/map");
  });

  it("방이 없는 가챠(옛날 방)는 지도 버튼이 없다", () => {
    expect(roomMapHref(null)).toBeNull();
  });

  it("이상한 방 코드면 지도 버튼을 만들지 않는다", () => {
    expect(roomMapHref("../admin")).toBeNull();
  });
});
