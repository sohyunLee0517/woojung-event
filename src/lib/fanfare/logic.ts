import { COUNTDOWN_MS, countdownLeft, everyoneReady as allReady } from "@/lib/ukiki/ready";
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
export { COUNTDOWN_MS }; // 모두 준비되면 3·2·1 (모든 게임 공통)

export type FanfareStatus = "WAITING" | "PLAYING" | "CELEBRATING";
export type FanfarePhase = "WAITING" | "COUNTDOWN" | "PLAYING" | "CELEBRATION" | "RANKING" | "BLACKOUT" | "REVEAL";

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

/** countdownMs 만큼 뒤에 시작한다 (그동안은 3·2·1 카운트다운) */
export function startState(_s: FanfareState, now: number, countdownMs = 0): FanfareState {
  const at = now + countdownMs;
  return { status: "PLAYING", temperature: 0, updatedAt: at, startedAt: at, celebratedAt: null };
}

/** 카운트다운에 보여 줄 숫자 (3 → 2 → 1). 시작했으면 0 */
export function countdownNumber(s: FanfareState, now: number): number {
  if (s.status !== "PLAYING") return 0;
  return countdownLeft(s.startedAt, now);
}

/** 화면에 들어온 사람이 2명 이상이고 모두 '준비완료'를 눌렀는지 */
export function everyoneReady(players: Record<string, { ready?: boolean }>): boolean {
  return allReady(Object.values(players));
}

const round1 = (n: number) => Math.round(n * 1000) / 1000;

export function effectiveTemperature(s: FanfareState, now: number): number {
  if (s.status === "WAITING") return 0;
  if (s.status === "CELEBRATING") return 100;
  if (s.startedAt !== null && now < s.startedAt) return 0;
  const elapsed = Math.max(0, now - (s.updatedAt ?? now)) / 1000;
  return Math.max(0, round1(s.temperature - DECAY_PER_SEC * elapsed));
}

/** 탭 한 번. playerCount 는 지금 들어와 있는 참가자 수 (호스트 제외) */
export function applyTap(s: FanfareState, now: number, playerCount: number): FanfareState {
  if (s.status !== "PLAYING") return s;
  if (s.startedAt !== null && now < s.startedAt) return s; // 카운트다운 중
  const gain = TAP_GAIN_TOTAL / Math.max(1, playerCount);
  const next = Math.min(100, round1(effectiveTemperature(s, now) + gain));
  if (next >= 100) return { ...s, status: "CELEBRATING", temperature: 100, updatedAt: now, celebratedAt: now };
  return { ...s, temperature: next, updatedAt: now };
}

/** reveal: false 면 호스트 영상 공개 없이 폭죽 → 순위에서 끝난다 (LEGACY.fanfareHost 꺼짐) */
export function derivePhase(
  s: FanfareState,
  now: number,
  { reveal = true }: { reveal?: boolean } = {},
): { phase: FanfarePhase; msUntilNext: number | null } {
  if (s.status === "WAITING") return { phase: "WAITING", msUntilNext: null };
  if (s.status === "PLAYING" && s.startedAt !== null && now < s.startedAt)
    return { phase: "COUNTDOWN", msUntilNext: s.startedAt - now };
  if (s.status === "PLAYING" || s.celebratedAt === null) return { phase: "PLAYING", msUntilNext: null };
  const t = now - s.celebratedAt;
  if (!reveal) {
    if (t < CELEBRATION_MS) return { phase: "CELEBRATION", msUntilNext: CELEBRATION_MS - Math.max(0, t) };
    return { phase: "RANKING", msUntilNext: null };
  }
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
  if (phase === "WAITING") return { outcome: "cancelled", label: "우정의 온도 닫기" };
  if (phase === "REVEAL") return { outcome: "completed", label: "우정의 온도 끝내기" };
  return { outcome: "aborted", label: "중단하기" };
}

/** 시작 조건: 호스트 카메라가 켜져 있고, 호스트 말고 친구가 1명 이상 (모두 2명 이상) */
export function canStartFanfare(input: { cameraOn: boolean; playerCount: number }): { ok: boolean; reason: string | null } {
  if (!input.cameraOn) return { ok: false, reason: "카메라를 먼저 켜 주세요" };
  if (input.playerCount < 1) return { ok: false, reason: "친구가 1명 이상 들어와야 해요 (2명부터)" };
  return { ok: true, reason: null };
}

/** 호스트 없는 빵빠레: 화면에 들어온 사람(나 포함)이 2명 이상이면 누구나 시작 */
export function canStartTogether(playerCount: number): { ok: boolean; reason: string | null } {
  if (playerCount < 2) return { ok: false, reason: "2명부터 시작할 수 있어요" };
  return { ok: true, reason: null };
}
