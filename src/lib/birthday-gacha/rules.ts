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

/** 방에 들어올 때 주는 뽑기권. 지금은 테스트를 위해 3장, 나중에 1장 + 미션 보상으로 바꾼다. */
export const TICKETS_ON_JOIN = 3;

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
