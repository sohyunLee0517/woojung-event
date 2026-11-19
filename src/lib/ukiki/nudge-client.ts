// 재촉하기 버튼에서 부른다. 결과를 화면에 띄울 짧은 문구로 돌려준다.
export async function requestNudge(roomCode: string, game: number | string): Promise<string> {
  const res = await fetch(`/api/ukiki/rooms/${roomCode}/games/${game}/nudge`, { method: "POST" }).catch(() => null);
  const r = res ? ((await res.json().catch(() => null)) as { ok: boolean; sent?: number; reason?: string } | null) : null;
  if (r?.ok) return r.sent ? `📣 ${r.sent}명에게 재촉했어요!` : "알림을 받을 수 있는 친구가 없어요";
  if (r?.reason === "cooldown") return "방금 재촉했어요. 1분 뒤에 다시 눌러 주세요";
  return "재촉하지 못했어요";
}
