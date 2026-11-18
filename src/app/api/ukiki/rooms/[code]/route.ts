import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRoomDetail, normalizeRoomCode, touchRoomMember } from "@/lib/ukiki/rooms";

// 방 화면이 몇 초마다 불러 간다. 부를 때마다 접속 중으로 표시된다.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  await touchRoomMember(code, me);
  const room = await getRoomDetail(code, me);
  if (!room) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, room, me });
}
