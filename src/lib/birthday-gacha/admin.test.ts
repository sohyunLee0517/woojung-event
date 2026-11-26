import { describe, expect, it } from "vitest";
import { adminAccess, buildPlayerStatus, deviceLabel, isAdmin, parseAdminIds } from "./admin";

describe("parseAdminIds", () => {
  it("쉼표로 나눈 ID 목록을 공백 없이 돌려준다", () => {
    expect(parseAdminIds(" 111, 222 ,,333 ")).toEqual(["111", "222", "333"]);
  });

  it("값이 없으면 빈 목록", () => {
    expect(parseAdminIds(undefined)).toEqual([]);
    expect(parseAdminIds("")).toEqual([]);
  });
});

describe("isAdmin", () => {
  const admins = ["5191279318"];

  it("목록에 있는 ID면 관리자", () => {
    expect(isAdmin("5191279318", admins)).toBe(true);
  });

  it("목록에 없거나 로그인 안 했으면 관리자가 아니다", () => {
    expect(isAdmin("5191401220", admins)).toBe(false);
    expect(isAdmin(undefined, admins)).toBe(false);
    expect(isAdmin("", admins)).toBe(false);
  });

  it("관리자 목록이 비어 있으면 아무도 관리자가 아니다", () => {
    expect(isAdmin("5191279318", [])).toBe(false);
  });
});

describe("adminAccess", () => {
  const admins = ["5191279318"];

  it("로그인 안 했으면 login", () => {
    expect(adminAccess(undefined, admins)).toBe("login");
  });

  it("관리자가 아니면 forbidden (주소로 바로 들어와도 막힌다)", () => {
    expect(adminAccess("5191401220", admins)).toBe("forbidden");
  });

  it("관리자면 ok", () => {
    expect(adminAccess("5191279318", admins)).toBe("ok");
  });
});

describe("deviceLabel", () => {
  it("기기 종류를 사람이 읽을 이름으로 바꾼다", () => {
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15")).toBe("아이폰");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/131 Mobile")).toBe("안드로이드");
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131")).toBe("PC");
    expect(deviceLabel(null)).toBe("알 수 없음");
  });
});

describe("buildPlayerStatus", () => {
  const players = [
    { kakaoId: "a", nickname: "소현", lastSeenAt: "2026-11-18T05:20:00.000Z" },
    { kakaoId: "b", nickname: "영한", lastSeenAt: "2026-11-18T03:00:00.000Z" },
    { kakaoId: "c", nickname: "친구", lastSeenAt: null },
  ];
  const subscriptions = [
    {
      kakaoId: "a",
      endpoint: "a-phone",
      userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/131 Mobile",
      lastSeenAt: "2026-11-18T05:10:00.000Z",
      createdAt: "2026-11-10T00:00:00.000Z",
    },
    {
      kakaoId: "a",
      endpoint: "a-pc",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131",
      lastSeenAt: "2026-11-18T05:20:00.000Z",
      createdAt: "2026-11-01T00:00:00.000Z",
    },
    {
      kakaoId: "b",
      endpoint: "b-phone",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)",
      lastSeenAt: "2026-11-18T03:00:00.000Z",
      createdAt: "2026-11-01T00:00:00.000Z",
    },
  ];
  const build = (nowIso: string) => buildPlayerStatus({ players, subscriptions, now: new Date(nowIso).getTime() });

  it("사람마다 등록한 기기 수와 종류를 모은다", () => {
    const rows = build("2026-11-18T05:30:00.000Z");
    expect(rows.find((r) => r.kakaoId === "a")).toMatchObject({ devices: 2, deviceLabels: ["안드로이드", "PC"], pushOn: true });
    expect(rows.find((r) => r.kakaoId === "c")).toMatchObject({ devices: 0, deviceLabels: [], pushOn: false });
  });

  it("알림은 마지막으로 접속한 기기 한 대로 간다고 표시한다", () => {
    const rows = build("2026-11-18T05:30:00.000Z");
    expect(rows.find((r) => r.kakaoId === "a")?.targetDevice).toBe("PC");
    expect(rows.find((r) => r.kakaoId === "b")?.targetDevice).toBe("아이폰");
    expect(rows.find((r) => r.kakaoId === "c")?.targetDevice).toBeNull();
  });

  it("알림을 안 켠 사람은 '알림 꺼짐' 경고", () => {
    const rows = build("2026-11-18T05:30:00.000Z");
    expect(rows.find((r) => r.kakaoId === "c")?.warning).toBe("알림 꺼짐");
  });

  it("알림을 켠 사람은 경고 없음 (퀴즈 구간 알림은 없어졌다)", () => {
    const rows = build("2026-11-18T05:30:00.000Z");
    expect(rows.find((r) => r.kakaoId === "a")?.warning).toBeNull();
    expect(rows.find((r) => r.kakaoId === "b")?.warning).toBeNull();
    expect(rows[0]).not.toHaveProperty("notifiedThisWindow");
  });

  it("20초 안에 접속했으면 온라인", () => {
    const rows = build("2026-11-18T05:20:10.000Z");
    expect(rows.find((r) => r.kakaoId === "a")?.online).toBe(true);
    expect(rows.find((r) => r.kakaoId === "b")?.online).toBe(false);
    expect(rows.find((r) => r.kakaoId === "c")?.online).toBe(false);
  });
});
