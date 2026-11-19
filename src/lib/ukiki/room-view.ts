// 모든 게임은 2명부터. 방에 혼자면 게임 대신 친구 초대를 보여 준다.
export const MIN_PLAYERS = 2;

// active: 진행 중 영역. 열린 게임이 하나도 없으면 숨긴다 (새 게임 버튼만 남는다).
export function roomSections(input: { memberCount: number; activeGames: number }) {
  const enough = input.memberCount >= MIN_PLAYERS;
  return { invite: !enough, games: enough, active: enough && input.activeGames > 0 };
}

/** 직전 멤버 목록과 비교해 새로 들어온 사람. 처음 불러올 때(prev 없음)는 빈 목록 */
export function joinedMembers<T extends { kakaoId: string }>(prevIds: string[] | null, next: T[]): T[] {
  if (!prevIds) return [];
  const prev = new Set(prevIds);
  return next.filter((m) => !prev.has(m.kakaoId));
}
