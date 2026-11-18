import { describe, expect, it } from "vitest";
import { orderByRecency, pickTargetSubscription } from "./push-target";

const sub = (endpoint: string, lastSeenAt: string, createdAt = "2026-11-01T00:00:00.000Z") => ({
  endpoint,
  lastSeenAt,
  createdAt,
});

describe("pickTargetSubscription", () => {
  it("기기가 없으면 null", () => {
    expect(pickTargetSubscription([])).toBeNull();
  });

  it("기기가 하나면 그 기기", () => {
    expect(pickTargetSubscription([sub("pc", "2026-11-18T04:00:00.000Z")])?.endpoint).toBe("pc");
  });

  it("마지막으로 접속한 기기 한 대에만 보낸다", () => {
    const picked = pickTargetSubscription([
      sub("pc", "2026-11-18T04:00:00.000Z"),
      sub("phone", "2026-11-18T05:00:00.000Z"),
      sub("tablet", "2026-11-17T23:00:00.000Z"),
    ]);
    expect(picked?.endpoint).toBe("phone");
  });

  it("PC로 다시 접속하면 PC로 바뀐다", () => {
    const picked = pickTargetSubscription([
      sub("pc", "2026-11-18T06:00:00.000Z"),
      sub("phone", "2026-11-18T05:00:00.000Z"),
    ]);
    expect(picked?.endpoint).toBe("pc");
  });

  it("접속 시각이 같으면 나중에 등록한 기기", () => {
    const picked = pickTargetSubscription([
      sub("old", "2026-11-18T05:00:00.000Z", "2026-11-01T00:00:00.000Z"),
      sub("new", "2026-11-18T05:00:00.000Z", "2026-11-10T00:00:00.000Z"),
    ]);
    expect(picked?.endpoint).toBe("new");
  });
});

describe("orderByRecency", () => {
  it("최근 접속 순으로 줄 세운다 (맨 앞이 만료되면 다음 기기로 넘어가기 위해)", () => {
    const ordered = orderByRecency([
      sub("pc", "2026-11-18T04:00:00.000Z"),
      sub("phone", "2026-11-18T05:00:00.000Z"),
      sub("tablet", "2026-11-17T23:00:00.000Z"),
    ]);
    expect(ordered.map((s) => s.endpoint)).toEqual(["phone", "pc", "tablet"]);
  });
});
