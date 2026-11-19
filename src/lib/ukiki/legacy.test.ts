import { beforeEach, describe, expect, it, vi } from "vitest";

// 보류한 기능(레거시): 퀴즈·특수카드, 지도 공격, 빵빠레 호스트·영상. 스위치를 켜기 전엔 꺼져 있어야 한다.
const notifyQuizWindow = vi.fn(async () => ({ sent: 1 }));
vi.mock("@/lib/birthday-gacha/notify", () => ({ notifyQuizWindow }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "test-legacy" } }) }));
const startQuiz = vi.fn();
vi.mock("@/lib/birthday-gacha/quiz", () => ({ startQuiz, answerQuiz: vi.fn() }));

describe("레거시 스위치", () => {
  beforeEach(() => {
    notifyQuizWindow.mockClear();
    startQuiz.mockClear();
    process.env.CRON_SECRET = "s3cret";
  });

  it("퀴즈·특수카드, 지도 공격, 빵빠레 호스트·영상은 꺼져 있다", async () => {
    const { LEGACY } = await import("./legacy");
    expect(LEGACY).toEqual({ quizCards: false, mapAttack: false, fanfareHost: false });
  });

  it("예약 퀴즈 알림이 불려도 푸시를 보내지 않는다", async () => {
    const { GET } = await import("@/app/api/birthday-gacha/push/quiz/route");
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer s3cret" } }));
    expect(await res.json()).toEqual({ ok: true, skipped: "legacy" });
    expect(notifyQuizWindow).not.toHaveBeenCalled();
  });

  it("퀴즈 API 는 410(보류됨)을 돌려준다", async () => {
    const { POST } = await import("@/app/api/birthday-gacha/games/[code]/quiz/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ action: "start" }) }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(410);
    expect(startQuiz).not.toHaveBeenCalled();
  });
});
