import { describe, expect, it } from "vitest";
import {
  BLACKOUT_MS,
  CELEBRATION_MS,
  DECAY_PER_SEC,
  RANKING_MS,
  TAP_GAIN_TOTAL,
  applyTap,
  derivePhase,
  effectiveTemperature,
  canStartFanfare,
  canStartTogether,
  countdownNumber,
  everyoneReady,
  COUNTDOWN_MS,
  hostEndAction,
  initialState,
  startState,
  tapRanking,
  temperatureLabel,
  type FanfareState,
} from "./logic";

const T0 = 1_800_000_000_000;

describe("온도 (탭 + 시간에 따른 식음)", () => {
  it("대기 중에는 0도", () => {
    expect(effectiveTemperature(initialState(), T0)).toBe(0);
  });

  it("진행 중에는 1초에 0.12도씩 식고 0 밑으로는 안 내려간다", () => {
    const s: FanfareState = { ...startState(initialState(), T0), temperature: 10, updatedAt: T0 };
    expect(effectiveTemperature(s, T0 + 10_000)).toBeCloseTo(10 - DECAY_PER_SEC * 10);
    expect(effectiveTemperature(s, T0 + 1_000_000)).toBe(0);
  });

  it("탭 한 번 = 2.5도 ÷ 참가 인원 (인원이 많아도 전체 속도는 비슷)", () => {
    const s = startState(initialState(), T0);
    expect(applyTap(s, T0, 1).temperature).toBeCloseTo(TAP_GAIN_TOTAL);
    expect(applyTap(s, T0, 5).temperature).toBeCloseTo(TAP_GAIN_TOTAL / 5);
  });

  it("탭은 식은 온도에서부터 더한다 (덮어쓰기로 다른 사람 탭이 사라지지 않음)", () => {
    let s = startState(initialState(), T0);
    s = applyTap(s, T0, 2); // 1.25
    s = applyTap(s, T0 + 100, 2); // 다른 친구 탭
    expect(s.temperature).toBeCloseTo(2.5 - DECAY_PER_SEC * 0.1);
  });

  it("진행 중이 아니면 탭이 반영되지 않는다", () => {
    const s = initialState();
    expect(applyTap(s, T0, 3)).toEqual(s);
  });

  it("100도를 넘는 순간 축하 단계로 넘어가고 그 시각을 기록한다", () => {
    const s: FanfareState = { ...startState(initialState(), T0), temperature: 99.5, updatedAt: T0 };
    const next = applyTap(s, T0, 1);
    expect(next.temperature).toBe(100);
    expect(next.status).toBe("CELEBRATING");
    expect(next.celebratedAt).toBe(T0);
  });

  it("축하가 시작된 뒤에는 탭을 더 해도 시각이 바뀌지 않는다", () => {
    const s: FanfareState = { ...startState(initialState(), T0), temperature: 99.5, updatedAt: T0 };
    const once = applyTap(s, T0, 1);
    expect(applyTap(once, T0 + 500, 1)).toEqual(once);
  });

  it("온도 문구", () => {
    expect(temperatureLabel(10)).toBe("냉랭함 ❄️");
    expect(temperatureLabel(45)).toBe("따스함 🌤");
    expect(temperatureLabel(75)).toBe("뜨거움 🔥");
    expect(temperatureLabel(95)).toBe("불타는 중 💥");
    expect(temperatureLabel(100)).toBe("MAX 우정! 🏆");
  });
});

describe("단계 (서버 시각 기준 — 누가 새로고침해도 이어서 진행)", () => {
  const celebrated = (): FanfareState => ({
    ...startState(initialState(), T0),
    status: "CELEBRATING",
    temperature: 100,
    celebratedAt: T0,
  });

  it("대기/진행", () => {
    expect(derivePhase(initialState(), T0).phase).toBe("WAITING");
    expect(derivePhase(startState(initialState(), T0), T0).phase).toBe("PLAYING");
  });

  it("100도 이후: 폭죽 3초 → 순위 4초 → 암전 3초 → 공개", () => {
    const s = celebrated();
    expect(derivePhase(s, T0).phase).toBe("CELEBRATION");
    expect(derivePhase(s, T0 + CELEBRATION_MS - 1).phase).toBe("CELEBRATION");
    expect(derivePhase(s, T0 + CELEBRATION_MS).phase).toBe("RANKING");
    expect(derivePhase(s, T0 + CELEBRATION_MS + RANKING_MS).phase).toBe("BLACKOUT");
    expect(derivePhase(s, T0 + CELEBRATION_MS + RANKING_MS + BLACKOUT_MS).phase).toBe("REVEAL");
    expect(derivePhase(s, T0 + 10 * 60_000).phase).toBe("REVEAL");
  });

  it("다음 단계까지 남은 시간을 알려 준다 (공개 이후는 null)", () => {
    const s = celebrated();
    expect(derivePhase(s, T0 + 1000).msUntilNext).toBe(CELEBRATION_MS - 1000);
    expect(derivePhase(s, T0 + 60_000).msUntilNext).toBeNull();
  });

});

describe("hostEndAction (호스트의 끝내기 버튼)", () => {
  it("시작 전에는 '닫기' (기록에 안 남음)", () => {
    expect(hostEndAction("WAITING")).toEqual({ outcome: "cancelled", label: "우정의 온도 닫기" });
  });

  it("시작한 뒤 공개 전까지는 '중단' (기록에 중단으로 남음)", () => {
    for (const p of ["PLAYING", "CELEBRATION", "RANKING", "BLACKOUT"] as const) {
      expect(hostEndAction(p)).toEqual({ outcome: "aborted", label: "중단하기" });
    }
  });

  it("공개 뒤에는 '끝내기' (완료 기록)", () => {
    expect(hostEndAction("REVEAL")).toEqual({ outcome: "completed", label: "우정의 온도 끝내기" });
  });
});

describe("tapRanking (탭 순위)", () => {
  const players = [
    { id: "a", name: "소현" },
    { id: "b", name: "영한" },
    { id: "c", name: "가나" },
  ];

  it("탭 많은 순, 같으면 이름순 · 메달은 3등까지", () => {
    const r = tapRanking(players, { a: 10, b: 25, c: 10 });
    expect(r.map((x) => [x.id, x.rank, x.medal])).toEqual([
      ["b", 1, "🥇"],
      ["c", 2, "🥈"],
      ["a", 2, "🥈"],
    ]);
  });

  it("탭을 안 한 사람은 0탭", () => {
    const r = tapRanking(players, { a: 3 });
    expect(r.find((x) => x.id === "b")?.taps).toBe(0);
  });

  it("인원 제한 없음: 10명도 순위가 나온다", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `친구${i}` }));
    const taps = Object.fromEntries(many.map((p, i) => [p.id, i]));
    const r = tapRanking(many, taps);
    expect(r).toHaveLength(10);
    expect(r[0].id).toBe("p9");
    expect(r[9].medal).toBe("");
  });
});

describe("canStartFanfare (시작 조건: 카메라 + 2명 이상)", () => {
  it("카메라가 꺼져 있으면 시작할 수 없다", () => {
    expect(canStartFanfare({ cameraOn: false, playerCount: 3 })).toEqual({ ok: false, reason: "카메라를 먼저 켜 주세요" });
  });

  it("호스트 혼자면(친구 0명) 시작할 수 없다", () => {
    expect(canStartFanfare({ cameraOn: true, playerCount: 0 })).toEqual({ ok: false, reason: "친구가 1명 이상 들어와야 해요 (2명부터)" });
  });

  it("카메라 켜고 친구 1명 이상이면 시작", () => {
    expect(canStartFanfare({ cameraOn: true, playerCount: 1 })).toEqual({ ok: true, reason: null });
  });
});

describe("호스트·영상 없는 빵빠레 (LEGACY.fanfareHost 꺼짐)", () => {
  it("100도 뒤 폭죽 → 순위에서 끝난다 (암전·영상 공개 없음)", () => {
    const s = { ...startState(initialState(), T0), status: "CELEBRATING" as const, temperature: 100, celebratedAt: T0 };
    const opt = { reveal: false };
    expect(derivePhase(s, T0, opt).phase).toBe("CELEBRATION");
    expect(derivePhase(s, T0 + CELEBRATION_MS, opt)).toEqual({ phase: "RANKING", msUntilNext: null });
    expect(derivePhase(s, T0 + 10 * 60_000, opt).phase).toBe("RANKING");
  });

  it("들어온 사람이 2명 이상이면 누구나 시작할 수 있다", () => {
    expect(canStartTogether(1)).toEqual({ ok: false, reason: "2명부터 시작할 수 있어요" });
    expect(canStartTogether(2)).toEqual({ ok: true, reason: null });
  });
});

describe("모두 준비 → 3·2·1 카운트다운", () => {
  it("모두 준비완료이고 2명 이상일 때만 카운트다운을 시작한다", () => {
    expect(everyoneReady({})).toBe(false);
    expect(everyoneReady({ a: { ready: true } })).toBe(false);
    expect(everyoneReady({ a: { ready: true }, b: { ready: false } })).toBe(false);
    expect(everyoneReady({ a: { ready: true }, b: {} })).toBe(false);
    expect(everyoneReady({ a: { ready: true }, b: { ready: true } })).toBe(true);
  });

  it("시작 시각을 3초 뒤로 잡고, 그때까지는 카운트다운 단계다", () => {
    const s = startState(initialState(), T0, COUNTDOWN_MS);
    expect(s.startedAt).toBe(T0 + COUNTDOWN_MS);
    expect(derivePhase(s, T0)).toEqual({ phase: "COUNTDOWN", msUntilNext: COUNTDOWN_MS });
    expect(countdownNumber(s, T0)).toBe(3);
    expect(countdownNumber(s, T0 + 1500)).toBe(2);
    expect(countdownNumber(s, T0 + 2500)).toBe(1);
    expect(derivePhase(s, T0 + COUNTDOWN_MS).phase).toBe("PLAYING");
  });

  it("카운트다운 중 탭은 무시하고, 온도도 식지 않는다", () => {
    const s = startState(initialState(), T0, COUNTDOWN_MS);
    expect(applyTap(s, T0 + 1000, 2)).toBe(s);
    expect(effectiveTemperature(s, T0 + 1000)).toBe(0);
    expect(applyTap(s, T0 + COUNTDOWN_MS, 2).temperature).toBeGreaterThan(0);
  });
});
