// 지도 ↔ 방 이동. 지도에서 '돌아가기'를 누르면 온 곳(방)으로 돌려보낸다.

const ROOM_PATH = /^\/birthday-gacha\/g\/[A-Z0-9]{6}$/;

export function mapHref(from?: string) {
  return from ? `/birthday-gacha/map?from=${encodeURIComponent(from)}` : "/birthday-gacha/map";
}

export function mapBack(from: string | null | undefined): { href: string; label: string } {
  if (from && ROOM_PATH.test(from)) return { href: from, label: "← 방으로" };
  return { href: "/birthday-gacha", label: "← 홈" };
}
