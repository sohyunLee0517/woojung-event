import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteRoom, getRoomDetail, normalizeRoomCode, touchRoomMember } from "@/lib/ukiki/rooms";
import { getSql } from "@/lib/db";
import { clearFanfareRealtime } from "@/lib/firebase-admin";

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

// 방 없애기 (방장만). 진행 중이던 빵빠레의 실시간 데이터도 지운다.
export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const fanfares = (await getSql()`
    select id from uk_room_games where room_code = ${code} and game_type = 'fanfare' and status = 'active'
  `) as { id: number }[];
  const ok = await deleteRoom(code, me);
  if (ok) for (const f of fanfares) await clearFanfareRealtime(Number(f.id)).catch(() => {});
  return NextResponse.json({ ok }, { status: ok ? 200 : 403 });
}
