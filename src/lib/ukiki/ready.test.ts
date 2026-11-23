import { describe, expect, it } from "vitest";
import { COUNTDOWN_MS, countdownLeft, everyoneReady, readyPhase, showGoBurst, WAIT_LIMIT_MS, waitLeftSeconds, waitOutcome } from "./ready";

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

// 대기실: 전원이 준비완료하면 바로, 아니면 제한 시간까지 기다렸다가 준비한 사람끼리. 2명이 안 되면 노게임.
describe("대기실 규칙", () => {
  const opened = 1_000_000;
  const over = opened + WAIT_LIMIT_MS;

  it("제한 시간은 2분", () => {
    expect(WAIT_LIMIT_MS).toBe(120_000);
  });

  it("방 인원 전원이 준비완료하면 기다리지 않고 바로 시작", () => {
    expect(waitOutcome({ roomSize: 5, ready: 5, openedAt: opened, now: opened + 1000 })).toBe("start");
    expect(waitOutcome({ roomSize: 2, ready: 2, openedAt: opened, now: opened })).toBe("start");
  });

  it("일부만 준비완료했으면 (들어온 사람이 다 준비했어도) 제한 시간까지 기다린다", () => {
    expect(waitOutcome({ roomSize: 5, ready: 3, openedAt: opened, now: over - 1 })).toBe("wait");
    expect(waitOutcome({ roomSize: 5, ready: 1, openedAt: opened, now: over - 1 })).toBe("wait");
  });

  it("제한 시간이 되면 준비완료한 사람(2명 이상)끼리 시작", () => {
    expect(waitOutcome({ roomSize: 5, ready: 3, openedAt: opened, now: over })).toBe("start");
    expect(waitOutcome({ roomSize: 5, ready: 2, openedAt: opened, now: over + 5000 })).toBe("start");
  });

  it("제한 시간에 준비완료한 사람이 2명이 안 되면 노게임", () => {
    expect(waitOutcome({ roomSize: 5, ready: 1, openedAt: opened, now: over })).toBe("cancel");
    expect(waitOutcome({ roomSize: 5, ready: 0, openedAt: opened, now: over })).toBe("cancel");
  });

  it("혼자 있는 방에서 혼자 준비한 건 '전원'으로 치지 않는다 (2명은 있어야 게임)", () => {
    expect(waitOutcome({ roomSize: 1, ready: 1, openedAt: opened, now: opened })).toBe("wait");
  });

  it("남은 시간(초): 올림, 지나면 0", () => {
    expect(waitLeftSeconds(over, over - 61_000)).toBe(61);
    expect(waitLeftSeconds(over, over - 500)).toBe(1);
    expect(waitLeftSeconds(over, over + 10)).toBe(0);
    expect(waitLeftSeconds(null, opened)).toBe(0);
  });
});
