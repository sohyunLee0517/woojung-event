// 생일 가챠 규칙 값. 숫자만 바꾸면 규칙이 바뀐다.

export type Grade = "SSR" | "SR" | "R" | "N";

export const GRADE_META: Record<Grade, { label: string; emoji: string; color: string }> = {
  SSR: { label: "SSR", emoji: "🌈", color: "#f5c542" },
  SR: { label: "SR", emoji: "✨", color: "#c084fc" },
  R: { label: "R", emoji: "⭐", color: "#60a5fa" },
  N: { label: "N", emoji: "🔹", color: "#9ca3af" },
};

/**
 * 한 방에 들어가는 캡슐 9개 (3명 × 3번).
 * 어떤 3개를 뽑아도 합계가 8,500~12,500엔 안에 들어오도록 짠 구성이다.
 * 금액이 클수록 쇼핑 시간이 짧다.
 */
export const CAPSULE_SET: { grade: Grade; amount: number; minutes: number }[] = [
  { grade: "SSR", amount: 4500, minutes: 1 },
  { grade: "SR", amount: 4000, minutes: 2 },
  { grade: "SR", amount: 4000, minutes: 2 },
  { grade: "R", amount: 3500, minutes: 3 },
  { grade: "R", amount: 3500, minutes: 3 },
  { grade: "R", amount: 3500, minutes: 3 },
  { grade: "N", amount: 3000, minutes: 4 },
  { grade: "N", amount: 3000, minutes: 4 },
  { grade: "N", amount: 2500, minutes: 5 },
];

export const MAX_PLAYERS = 3;

/** 방에 들어올 때 주는 뽑기권 */
export const TICKETS_ON_JOIN = 3;

/** 한 사람이 뽑을 수 있는 최대 횟수 (캡슐 9개 ÷ 3명) */
export const MAX_DRAWS_PER_PLAYER = 3;

/** 퀴즈 구간 길이. 0-2시, 2-4시 … 22-24시처럼 하루를 절대 시각으로 나눈다. */
export const QUIZ_WINDOW_MS = 2 * 60 * 60 * 1000;

/** 구간을 나누는 기준 시간대 (한국·일본 모두 UTC+9) */
export const QUIZ_TZ_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 지금 시각이 속한 2시간 구간의 시작과 끝 */
export function quizWindow(nowMs: number) {
  const local = nowMs + QUIZ_TZ_OFFSET_MS;
  const start = Math.floor(local / QUIZ_WINDOW_MS) * QUIZ_WINDOW_MS - QUIZ_TZ_OFFSET_MS;
  return { start, end: start + QUIZ_WINDOW_MS };
}

/** 구간 이름. 예) "20–22시" */
export function quizWindowLabel(startMs: number) {
  const h = new Date(startMs + QUIZ_TZ_OFFSET_MS).getUTCHours();
  return `${h}–${h + 2}시`;
}

/** 강탈 후에도 이 범위를 벗어나지 않는다 */
export const MONEY_MIN = 8000;
export const MONEY_MAX = 13000;

/** 마지막 접속 신호가 이 시간 안이면 온라인 */
export const ONLINE_WITHIN_S = 20;

/** 게임 화면이 상태를 다시 불러오는 간격 */
export const GAME_POLL_INTERVAL_MS = 3000;

/**
 * 실제로 뺏을 수 있는 금액.
 * - 상대가 MONEY_MIN 이하면 0
 * - 내가 MONEY_MAX 이상이면 0
 * - 내가 MONEY_MAX 를, 상대가 MONEY_MIN 을 넘지 않도록 깎는다
 */
export function stealAmount(requested: number, attackerMoney: number, targetMoney: number) {
  return Math.max(0, Math.min(requested, MONEY_MAX - attackerMoney, targetMoney - MONEY_MIN));
}

export const yen = (n: number) => `${n.toLocaleString("ko-KR")}엔`;

/** 퀴즈를 맞히면 이 중 하나를 무작위로 받는다. 사용 규칙(야외·50m)은 다음 단계에서 붙인다. */
export type CardType = "steal_money" | "steal_time" | "shield" | "reflect" | "rps";

export const CARD_META: Record<CardType, { emoji: string; name: string; desc: string }> = {
  steal_money: { emoji: "🏴‍☠️", name: "2,000엔 내놔!", desc: "1명을 지목해서 2,000엔을 뺏어요. (8,000~13,000엔 범위를 넘으면 깎여요)" },
  steal_time: { emoji: "⏱️", name: "2분 내놔!", desc: "1명을 지목해서 쇼핑 시간 2분을 뺏어요." },
  shield: { emoji: "🛡️", name: "방패", desc: "나에게 온 공격을 1번 막아요." },
  reflect: { emoji: "🪞", name: "반사", desc: "나에게 온 공격을 공격한 사람에게 그대로 돌려줘요." },
  rps: { emoji: "🎲", name: "가위바위보 승부", desc: "1명을 지목해 가위바위보! 이기면 2,000엔을 뺏고, 지면 1,000엔을 줘요." },
};

export const CARD_TYPES = Object.keys(CARD_META) as CardType[];
