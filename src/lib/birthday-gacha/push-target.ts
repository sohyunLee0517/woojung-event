// 알림은 마지막으로 접속한 기기 한 대에만 보낸다.

export type TargetCandidate = { endpoint: string; lastSeenAt: string; createdAt: string };

function newerFirst(a: TargetCandidate, b: TargetCandidate) {
  if (a.lastSeenAt !== b.lastSeenAt) return a.lastSeenAt > b.lastSeenAt ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt ? -1 : 1;
  return 0;
}

/** 최근 접속 순. 맨 앞 기기의 구독이 만료됐으면 다음 기기로 넘어갈 때 쓴다. */
export function orderByRecency<T extends TargetCandidate>(subs: T[]): T[] {
  return [...subs].sort(newerFirst);
}

export function pickTargetSubscription<T extends TargetCandidate>(subs: T[]): T | null {
  return orderByRecency(subs)[0] ?? null;
}
