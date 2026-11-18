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
  const windowStart = "2026-11-18T05:00:00.000Z"; // 14–16시 구간
  const players = [
    { kakaoId: "a", nickname: "소현", lastSeenAt: "2026-11-18T05:20:00.000Z" },
    { kakaoId: "b", nickname: "영한", lastSeenAt: "2026-11-18T03:00:00.000Z" },
    { kakaoId: "c", nickname: "친구", lastSeenAt: null },
  ];
  const subscriptions = [
    { kakaoId: "a", userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/131 Mobile" },
    { kakaoId: "a", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131" },
    { kakaoId: "b", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)" },
  ];
  const notifications = [
    { kakaoId: "a", windowStart, sentAt: "2026-11-18T05:00:30.000Z" },
    { kakaoId: "b", windowStart: "2026-11-18T03:00:00.000Z", sentAt: "2026-11-18T03:00:20.000Z" },
  ];

  const build = (nowIso: string, answered: string[] = []) =>
    buildPlayerStatus({
      players,
      subscriptions,
      notifications,
      answeredThisWindow: new Set(answered),
      windowStart,
      now: new Date(nowIso).getTime(),
    });

  it("사람마다 등록한 기기 수와 종류를 모은다", () => {
    const rows = build("2026-11-18T05:30:00.000Z");
    expect(rows.find((r) => r.kakaoId === "a")).toMatchObject({ devices: 2, deviceLabels: ["안드로이드", "PC"], pushOn: true });
    expect(rows.find((r) => r.kakaoId === "c")).toMatchObject({ devices: 0, deviceLabels: [], pushOn: false });
  });

  it("마지막 알림 시각과 이번 구간 알림 여부를 알려 준다", () => {
    const rows = build("2026-11-18T05:30:00.000Z");
    expect(rows.find((r) => r.kakaoId === "a")).toMatchObject({
      lastNotifiedAt: "2026-11-18T05:00:30.000Z",
      notifiedThisWindow: true,
    });
    expect(rows.find((r) => r.kakaoId === "b")).toMatchObject({
      lastNotifiedAt: "2026-11-18T03:00:20.000Z",
      notifiedThisWindow: false,
    });
    expect(rows.find((r) => r.kakaoId === "c")?.lastNotifiedAt).toBeNull();
  });

  it("알림을 안 켠 사람은 '알림 꺼짐' 경고", () => {
    const rows = build("2026-11-18T05:30:00.000Z");
    expect(rows.find((r) => r.kakaoId === "c")?.warning).toBe("알림 꺼짐");
  });

  it("구간이 열리고 10분이 지났는데 알림도 안 가고 퀴즈도 안 풀었으면 '이번 알림 누락' 경고", () => {
    const rows = build("2026-11-18T05:30:00.000Z");
    expect(rows.find((r) => r.kakaoId === "b")?.warning).toBe("이번 알림 누락");
  });

  it("구간이 열린 지 10분 전이면 아직 보내는 중이라 경고하지 않는다", () => {
    const rows = build("2026-11-18T05:05:00.000Z");
    expect(rows.find((r) => r.kakaoId === "b")?.warning).toBeNull();
  });

  it("이미 이번 구간 퀴즈를 풀었으면 알림이 안 갔어도 괜찮다", () => {
    const rows = build("2026-11-18T05:30:00.000Z", ["b"]);
    expect(rows.find((r) => r.kakaoId === "b")).toMatchObject({ answeredThisWindow: true, warning: null });
  });

  it("알림도 켰고 이번 구간 알림도 갔으면 경고 없음", () => {
    const rows = build("2026-11-18T05:30:00.000Z");
    expect(rows.find((r) => r.kakaoId === "a")?.warning).toBeNull();
  });

  it("20초 안에 접속했으면 온라인", () => {
    const rows = build("2026-11-18T05:20:10.000Z");
    expect(rows.find((r) => r.kakaoId === "a")?.online).toBe(true);
    expect(rows.find((r) => r.kakaoId === "b")?.online).toBe(false);
    expect(rows.find((r) => r.kakaoId === "c")?.online).toBe(false);
  });
});
