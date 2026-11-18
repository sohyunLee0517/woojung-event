// 지난 게임 결과 계산 (순수 함수)

export function isGachaFinished(input: { total: number; drawn: number }) {
  return input.total > 0 && input.drawn >= input.total;
}

type GachaPlayer = { kakaoId: string; nickname: string | null; money: number; minutes: number };
export type GachaRank = GachaPlayer & { rank: number; badge: string };

/** 금액 큰 순 → 시간 긴 순. 둘 다 같으면 공동 등수 */
export function gachaRanking(players: GachaPlayer[]): GachaRank[] {
  const sorted = [...players].sort((a, b) => b.money - a.money || b.minutes - a.minutes);
  return sorted.map((p, i) => {
    const firstSame = sorted.findIndex((q) => q.money === p.money && q.minutes === p.minutes);
    const rank = (firstSame === -1 ? i : firstSame) + 1;
    return { ...p, rank, badge: rank === 1 ? "👑" : "" };
  });
}
