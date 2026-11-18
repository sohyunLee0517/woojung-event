import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cronHoursUtc, isCronAuthorized } from "./cron";
import { quizWindow } from "./rules";

describe("isCronAuthorized", () => {
  it("Bearer 비밀값이 정확히 맞을 때만 통과", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isCronAuthorized("Bearer wrong", "s3cret")).toBe(false);
    expect(isCronAuthorized("s3cret", "s3cret")).toBe(false);
    expect(isCronAuthorized(null, "s3cret")).toBe(false);
  });

  it("서버에 비밀값이 없으면 아무도 못 부른다", () => {
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
  });
});

describe("cronHoursUtc", () => {
  it("'분 시 * * *' 형태에서 실행 시(UTC)를 펼친다", () => {
    expect(cronHoursUtc("0,15 1-23/2 * * *")).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]);
    expect(cronHoursUtc("0 4,10 * * *")).toEqual([4, 10]);
  });
});

describe("GitHub Actions 퀴즈 알림 예약", () => {
  const yml = readFileSync(".github/workflows/quiz-push.yml", "utf8");
  const crons = [...yml.matchAll(/cron:\s*["']([^"']+)["']/g)].map((m) => m[1]);

  it("예약이 하나 이상 있다", () => {
    expect(crons.length).toBeGreaterThan(0);
  });

  it("하루 12개 퀴즈 구간(한국 시간 0,2,…,22시)이 열릴 때마다 실행된다", () => {
    const hours = new Set(crons.flatMap(cronHoursUtc));
    for (let kst = 0; kst < 24; kst += 2) {
      const utcHour = (kst - 9 + 24) % 24;
      expect(hours.has(utcHour), `한국 ${kst}시(UTC ${utcHour}시)`).toBe(true);
    }
  });

  it("실행되는 시각은 모두 구간이 막 열린 순간이다 (엉뚱한 시간에 보내지 않음)", () => {
    for (const h of new Set(crons.flatMap(cronHoursUtc))) {
      const t = Date.UTC(2026, 2, 14, h, 0);
      expect(quizWindow(t).start, `UTC ${h}시`).toBe(t);
    }
  });

  it("GitHub 예약이 늦거나 빠질 때를 대비해 구간마다 두 번 이상 시도한다", () => {
    const minutes = crons.flatMap((c) => c.split(/\s+/)[0].split(","));
    expect(minutes.length).toBeGreaterThanOrEqual(2);
  });

  it("배포 주소의 알림 API를 CRON_SECRET 으로 부른다", () => {
    expect(yml).toContain("/api/birthday-gacha/push/quiz");
    expect(yml).toContain("secrets.CRON_SECRET");
  });
});
