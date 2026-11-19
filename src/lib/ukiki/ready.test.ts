import { describe, expect, it } from "vitest";
import { COUNTDOWN_MS, countdownLeft, everyoneReady, readyPhase, showGoBurst } from "./ready";

// 모든 게임 공통: 모두 준비완료 → 3·2·1 → 시작!
const T0 = 1_000_000;

describe("공통 준비 · 카운트다운", () => {
  it("2명 이상이 모두 준비완료여야 시작한다", () => {
    expect(everyoneReady([])).toBe(false);
    expect(everyoneReady([{ ready: true }])).toBe(false);
    expect(everyoneReady([{ ready: true }, { ready: false }])).toBe(false);
    expect(everyoneReady([{ ready: true }, { ready: true }])).toBe(true);
  });

  it("시작 시각 전엔 대기/카운트다운, 지나면 시작", () => {
    expect(readyPhase(null, T0)).toBe("WAITING");
    const at = T0 + COUNTDOWN_MS;
    expect(readyPhase(at, T0)).toBe("COUNTDOWN");
    expect(readyPhase(at, at)).toBe("STARTED");
  });

  it("3 → 2 → 1 숫자, 시작 뒤엔 0", () => {
    const at = T0 + COUNTDOWN_MS;
    expect(countdownLeft(at, T0)).toBe(3);
    expect(countdownLeft(at, T0 + 1500)).toBe(2);
    expect(countdownLeft(at, T0 + 2500)).toBe(1);
    expect(countdownLeft(at, at)).toBe(0);
    expect(countdownLeft(null, T0)).toBe(0);
  });

  it("시작 직후 0.9초 동안 '시작!'을 보여 준다", () => {
    const at = T0;
    expect(showGoBurst(at, at - 1)).toBe(false);
    expect(showGoBurst(at, at + 500)).toBe(true);
    expect(showGoBurst(at, at + 900)).toBe(false);
  });
});
