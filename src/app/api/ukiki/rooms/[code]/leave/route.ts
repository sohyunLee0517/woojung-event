import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { leaveRoom, normalizeRoomCode } from "@/lib/ukiki/rooms";

// 방 나가기
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  return NextResponse.json(await leaveRoom(code, me));
}
