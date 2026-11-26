import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGACY } from "./legacy";

// 보류한 기능(레거시). 퀴즈·특수카드와 지도 공격은 2026-11-26 에 코드까지 정리했다.
describe("레거시 스위치", () => {
  it("남은 스위치는 빵빠레 호스트·영상 하나이고 꺼져 있다", () => {
    expect(LEGACY).toEqual({ fanfareHost: false });
  });

  it("퀴즈·특수카드 코드는 지워졌다", () => {
    for (const f of [
      "src/app/api/birthday-gacha/push/quiz/route.ts",
      "src/app/api/birthday-gacha/games/[code]/quiz/route.ts",
      "src/lib/birthday-gacha/quiz.ts",
      "src/lib/birthday-gacha/quizzes.ts",
      ".github/workflows/quiz-push.yml",
    ]) {
      expect(existsSync(f), f).toBe(false);
    }
  });
});
