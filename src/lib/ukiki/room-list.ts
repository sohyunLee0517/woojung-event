// 로비 방 리스트: 검색 + 20개씩 더보기

export const ROOM_PAGE_SIZE = 20;
const SEARCH_MAX = 20;
const OFFSET_MAX = 1000;

export type RoomQuery = { q: string; offset: number; limit: number };

export function parseRoomQuery(input: { q?: string | null; offset?: string | null }): RoomQuery {
  const q = [...(input.q ?? "").trim()].slice(0, SEARCH_MAX).join("");
  const raw = Number(input.offset);
  let offset = Number.isInteger(raw) && raw > 0 && raw % ROOM_PAGE_SIZE === 0 ? raw : 0;
  if (offset > OFFSET_MAX) offset = OFFSET_MAX;
  return { q, offset, limit: ROOM_PAGE_SIZE };
}

/** 한 개 더(21개) 받아 와서 더보기가 있는지 판단한다 */
export function pageResult<T>(rows: T[], offset: number) {
  const hasMore = rows.length > ROOM_PAGE_SIZE;
  return {
    items: rows.slice(0, ROOM_PAGE_SIZE),
    hasMore,
    nextOffset: hasMore ? offset + ROOM_PAGE_SIZE : null,
  };
}

/** 검색어를 ILIKE 패턴으로. % _ \ 는 글자 그대로 찾는다 */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
