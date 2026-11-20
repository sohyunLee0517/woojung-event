import { describe, expect, it } from "vitest";
import { DT } from "./logic";
import { advancePlayback, catchUpSeconds, MAX_FRAME_S } from "./playback";

/** frameMs 간격으로 seconds 초 동안 돌렸을 때 물리 걸음 수 */
function stepsOver(seconds: number, frameMs: number, speed = 0.7) {
  let acc = 0;
  let steps = 0;
  for (let t = 0; t < seconds * 1000 - 1e-6; t += frameMs) {
    const r = advancePlayback(acc, frameMs / 1000, speed);
    acc = r.acc;
    steps += r.steps;
  }
  return steps;
}

describe("핀볼 재생 속도", () => {
  it("화면 주사율이 달라도(120·60·30Hz) 같은 시간에 같은 만큼 진행한다", () => {
    const want = Math.round((10 * 0.7) / DT);
    for (const ms of [1000 / 120, 1000 / 60, 1000 / 30]) {
      expect(Math.abs(stepsOver(10, ms) - want)).toBeLessThanOrEqual(1);
    }
  });

  it("폰이 느려서 프레임이 뚝뚝 끊겨도(10fps) 느려지지 않고 따라잡는다", () => {
    const want = Math.round((10 * 0.7) / DT);
    expect(Math.abs(stepsOver(10, 100) - want)).toBeLessThanOrEqual(1);
  });

  it("탭을 한참 내려놨다 돌아오면 한꺼번에 몰아 돌리지 않는다", () => {
    const r = advancePlayback(0, 30, 1);
    expect(r.steps).toBe(Math.round(MAX_FRAME_S / DT));
  });

  it("늦게 화면이 뜬 폰은 시작 시각 기준으로 그만큼 앞에서 시작한다", () => {
    expect(catchUpSeconds(10_000, 12_000, 0.7)).toBeCloseTo(1.4);
    expect(catchUpSeconds(10_000, 9_000, 0.7)).toBe(0); // 아직 시작 전
    expect(catchUpSeconds(null, 12_000, 0.7)).toBe(0);
  });
});
