// 빵빠레 게임 규칙 (순수 함수). Firebase 쓰기는 이 함수들로 계산한 값을 트랜잭션으로 저장한다.
//
// - 온도는 { temperature, updatedAt } 만 저장하고, 식는 것(decay)은 시간으로 계산한다
//   → 호스트가 1초마다 덮어쓰던 방식을 없애서 탭이 사라지지 않는다.
// - 100도 이후 단계는 celebratedAt(서버 시각) 기준으로 계산한다
//   → 누가 새로고침해도 같은 단계에서 이어진다.

export const TAP_GAIN_TOTAL = 2.5; // 모두 합쳐 탭 한 번에 오르는 정도 (인원으로 나눔)
export const DECAY_PER_SEC = 0.12;
export const CELEBRATION_MS = 3000;
export const RANKING_MS = 4000;
export const BLACKOUT_MS = 3000;

export type FanfareStatus = "WAITING" | "PLAYING" | "CELEBRATING";
export type FanfarePhase = "WAITING" | "PLAYING" | "CELEBRATION" | "RANKING" | "BLACKOUT" | "REVEAL";

export type FanfareState = {
  status: FanfareStatus;
  temperature: number;
  updatedAt: number | null;
  startedAt: number | null;
  celebratedAt: number | null;
};

export function initialState(): FanfareState {
  return { status: "WAITING", temperature: 0, updatedAt: null, startedAt: null, celebratedAt: null };
}

export function startState(_s: FanfareState, now: number): FanfareState {
  return { status: "PLAYING", temperature: 0, updatedAt: now, startedAt: now, celebratedAt: null };
}

const round1 = (n: number) => Math.round(n * 1000) / 1000;

export function effectiveTemperature(s: FanfareState, now: number): number {
  if (s.status === "WAITING") return 0;
  if (s.status === "CELEBRATING") return 100;
  const elapsed = Math.max(0, now - (s.updatedAt ?? now)) / 1000;
  return Math.max(0, round1(s.temperature - DECAY_PER_SEC * elapsed));
}

/** 탭 한 번. playerCount 는 지금 들어와 있는 참가자 수 (호스트 제외) */
export function applyTap(s: FanfareState, now: number, playerCount: number): FanfareState {
  if (s.status !== "PLAYING") return s;
  const gain = TAP_GAIN_TOTAL / Math.max(1, playerCount);
  const next = Math.min(100, round1(effectiveTemperature(s, now) + gain));
  if (next >= 100) return { ...s, status: "CELEBRATING", temperature: 100, updatedAt: now, celebratedAt: now };
  return { ...s, temperature: next, updatedAt: now };
}

export function derivePhase(s: FanfareState, now: number): { phase: FanfarePhase; msUntilNext: number | null } {
  if (s.status === "WAITING") return { phase: "WAITING", msUntilNext: null };
  if (s.status === "PLAYING" || s.celebratedAt === null) return { phase: "PLAYING", msUntilNext: null };
  const t = now - s.celebratedAt;
  const steps: [FanfarePhase, number][] = [
    ["CELEBRATION", CELEBRATION_MS],
    ["RANKING", CELEBRATION_MS + RANKING_MS],
    ["BLACKOUT", CELEBRATION_MS + RANKING_MS + BLACKOUT_MS],
  ];
  for (const [phase, until] of steps) if (t < until) return { phase, msUntilNext: until - Math.max(0, t) };
  return { phase: "REVEAL", msUntilNext: null };
}

export function temperatureLabel(t: number) {
  if (t >= 100) return "MAX 우정! 🏆";
  if (t >= 90) return "불타는 중 💥";
  if (t >= 60) return "뜨거움 🔥";
  if (t >= 30) return "따스함 🌤";
  return "냉랭함 ❄️";
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function tapRanking(players: { id: string; name: string }[], taps: Record<string, number>) {
  const rows = players
    .map((p) => ({ ...p, taps: taps[p.id] ?? 0 }))
    .sort((a, b) => b.taps - a.taps || a.name.localeCompare(b.name, "ko"));
  return rows.map((r) => {
    const rank = rows.findIndex((x) => x.taps === r.taps) + 1;
    return { ...r, rank, medal: MEDALS[rank - 1] ?? "" };
  });
}

export type FanfareOutcome = "completed" | "aborted" | "cancelled";

/** 호스트의 끝내기 버튼: 시작 전 '닫기'(기록 없음) · 진행 중 '중단'(중단 기록) · 공개 뒤 '끝내기'(완료) */
export function hostEndAction(phase: FanfarePhase): { outcome: FanfareOutcome; label: string } {
  if (phase === "WAITING") return { outcome: "cancelled", label: "빵빠레 닫기" };
  if (phase === "REVEAL") return { outcome: "completed", label: "빵빠레 끝내기" };
  return { outcome: "aborted", label: "중단하기" };
}
