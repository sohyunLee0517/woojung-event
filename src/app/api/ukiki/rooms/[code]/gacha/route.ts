import { after, NextResponse } from "next/server";
import { notifyNewGame } from "@/lib/ukiki/game-push";
import { auth } from "@/auth";
import { createGachaInRoom, normalizeRoomCode } from "@/lib/ukiki/rooms";

// 방 안에서 생일 가챠 한 판 열기 (이미 열려 있으면 conflict)
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const outcome = await createGachaInRoom(code, me);
  if (outcome.kind === "not_member") return NextResponse.json({ ok: false }, { status: 403 });
  // 새 게임 알림은 응답을 막지 않게 끝난 뒤에 보낸다
  if (outcome.kind === "created") after(() => notifyNewGame(code, outcome.gachaCode, me).catch((e) => console.error("[push] 새 게임 알림 실패", e)));
  return NextResponse.json({ ok: true, ...outcome });
}
