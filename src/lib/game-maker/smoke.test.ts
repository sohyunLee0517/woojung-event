import { describe, expect, it } from "vitest";
import { buildGameDocument } from "./kit";
import { AUTOFIX_MAX, evaluateSmoke, problemsForAI, SMOKE_VIRTUAL_LIMIT_MS, type SmokeObservation } from "./smoke";

const good = (over: Partial<SmokeObservation> = {}): SmokeObservation => ({
  errors: [],
  ended: false,
  scored: true,
  usedPlayers: true,
  usedKitIO: true,
  virtualMs: 30_000,
  stalled: false,
  ...over,
});

describe("자동 테스트 판정", () => {
  it("두 화면 모두 오류 없이 키트를 쓰고 결과를 내면 통과", () => {
    expect(evaluateSmoke([good(), good()])).toEqual({ ok: true, problems: [] });
    expect(evaluateSmoke([good({ scored: false, ended: true }), good({ scored: false })])).toEqual({ ok: true, problems: [] });
  });

  it("실행 오류가 있으면 실패 (같은 오류는 한 번만)", () => {
    const r = evaluateSmoke([good({ errors: ["TypeError: x is null (줄 12)"] }), good({ errors: ["TypeError: x is null (줄 12)"] })]);
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual(["실행 중 오류: TypeError: x is null (줄 12)"]);
  });

  it("아무도 결과(ukiki.end / ukiki.score)를 안 내면 실패", () => {
    const r = evaluateSmoke([good({ scored: false }), good({ scored: false })]);
    expect(r.problems).toContain(`게임이 ${SMOKE_VIRTUAL_LIMIT_MS / 60_000}분 안에 끝나지 않아요 (ukiki.end 나 모두의 ukiki.score 가 없어요)`);
  });

  it("점수로 끝내는 게임은 모두가 점수를 내야 한다", () => {
    const r = evaluateSmoke([good(), good({ scored: false })]);
    expect(r.ok).toBe(false);
  });

  it("참여자 목록을 안 쓰거나, 주고받기·결과 키트를 전혀 안 쓰면 실패", () => {
    expect(evaluateSmoke([good({ usedPlayers: false }), good({ usedPlayers: false })]).problems).toContain("참여자 목록(ukiki.players)을 쓰지 않아요");
    expect(evaluateSmoke([good({ usedKitIO: false }), good({ usedKitIO: false })]).problems).toContain("게임 키트(ukiki.on / send / end / score)를 쓰지 않아요");
  });

  it("멈추면(시간이 흐르지 않으면) 실패", () => {
    expect(evaluateSmoke([good({ stalled: true }), good()]).problems).toContain("게임이 멈췄어요 (끝없는 반복이 있는지 확인해 주세요)");
  });

  it("AI에게 넘길 글: 문제 목록", () => {
    expect(problemsForAI(["실행 중 오류: a", "게임이 멈췄어요"])).toBe("- 실행 중 오류: a\n- 게임이 멈췄어요");
    expect(AUTOFIX_MAX).toBe(3);
  });
});

describe("테스트용 문서", () => {
  it("테스트 모드면 시간 빨리 감기·오류 수집 스크립트가 게임보다 먼저 들어간다", () => {
    const doc = buildGameDocument("<script>GAME()</script>", { mode: "preview", me: "a", players: [], seed: 1 }, { test: true });
    expect(doc).toContain("__UKIKI_TEST__");
    expect(doc.indexOf("__UKIKI_TEST__")).toBeLessThan(doc.indexOf("GAME()"));
    expect(buildGameDocument("<p>x</p>", { mode: "play", me: "a", players: [], seed: 1 })).not.toContain("__UKIKI_TEST__");
  });
});
