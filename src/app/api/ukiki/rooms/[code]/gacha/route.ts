import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGachaInRoom, normalizeRoomCode } from "@/lib/ukiki/rooms";

// 방 안에서 생일 가챠 한 판 열기
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const gachaCode = await createGachaInRoom(code, me);
  if (!gachaCode) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, gachaCode });
}
