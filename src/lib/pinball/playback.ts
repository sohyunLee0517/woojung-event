// 핀볼 화면 재생 속도 (순수 함수).
// 물리는 고정 간격(DT)으로만 가고, 화면은 "실제로 흐른 시간"만큼 물리를 진행시킨다.
// 그래서 120Hz·60Hz·느린 폰 모두 같은 시간에 같은 만큼 굴러간다.
import { DT } from "./logic";

/** 한 프레임에 인정하는 최대 실제 시간(초). 탭을 내려놨다 돌아왔을 때 한꺼번에 몰아 돌리지 않게 */
export const MAX_FRAME_S = 1;

/** 실제 시간 realS(초)가 흘렀을 때 물리를 몇 걸음 갈지. acc 는 다음 프레임으로 넘기는 나머지 */
export function advancePlayback(acc: number, realS: number, speed: number): { steps: number; acc: number } {
  const total = acc + Math.min(MAX_FRAME_S, Math.max(0, realS)) * speed;
  const steps = Math.floor(total / DT + 1e-9);
  return { steps, acc: total - steps * DT };
}

/** 게임 시작 시각보다 화면이 늦게 떴으면 그만큼(재생 속도 반영) 먼저 진행해 둘 시간(초) */
export function catchUpSeconds(startedAtMs: number | null, nowMs: number, speed: number): number {
  if (startedAtMs === null || nowMs <= startedAtMs) return 0;
  return ((nowMs - startedAtMs) / 1000) * speed;
}
