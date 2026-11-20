import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createReport, listReports, REPORT_CATEGORIES } from "./reports";

// 앱 안 신고하기 (구글 플레이 아동 안전 표준: 앱 안에서 신고할 수 있어야 한다). 실제 DB.
const hasDb = !!process.env.DATABASE_URL;
const ME = "test-report-me";

describe.skipIf(!hasDb)("신고하기 (실제 DB)", () => {
  beforeAll(async () => {
    await getSql()`insert into players (kakao_id, nickname) values (${ME}, ${ME}) on conflict do nothing`;
  });
  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_reports where reporter_kakao_id = ${ME}`;
    await sql`delete from players where kakao_id = ${ME}`;
  });

  it("아동 안전 신고 항목이 있다", () => {
    expect(REPORT_CATEGORIES.map((c) => c.value)).toContain("child_safety");
  });

  it("내용이 비었거나 너무 길거나 종류가 이상하면 받지 않는다", async () => {
    expect(await createReport(ME, { category: "child_safety", body: "  " })).toEqual({ ok: false, error: "내용을 적어 주세요" });
    expect(await createReport(ME, { category: "child_safety", body: "가".repeat(1001) })).toEqual({
      ok: false,
      error: "1000자까지 적을 수 있어요",
    });
    expect(await createReport(ME, { category: "hack", body: "내용" })).toEqual({ ok: false, error: "신고 종류를 골라 주세요" });
  });

  it("신고를 저장하고 관리자 목록에서 최신순으로 본다", async () => {
    expect(await createReport(ME, { category: "harassment", body: "첫 신고" })).toEqual({ ok: true });
    expect(await createReport(ME, { category: "child_safety", body: "  두 번째 신고  ", roomCode: "abc123" })).toEqual({ ok: true });
    const mine = (await listReports()).filter((r) => r.reporterKakaoId === ME);
    expect(mine.map((r) => [r.category, r.body, r.roomCode])).toEqual([
      ["child_safety", "두 번째 신고", "ABC123"],
      ["harassment", "첫 신고", null],
    ]);
  });

  it("AI로 만든 게임도 신고할 수 있고, 어떤 게임인지 남는다", async () => {
    expect(REPORT_CATEGORIES.map((c) => c.value)).toContain("ai_game");
    expect(await createReport(ME, { category: "ai_game", body: "이상한 게임", roomCode: "abc123", aiGameId: 77 })).toEqual({ ok: true });
    const r = (await listReports()).find((x) => x.reporterKakaoId === ME && x.category === "ai_game");
    expect(r?.aiGameId).toBe(77);
  });
});
