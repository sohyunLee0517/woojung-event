import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseRoomQuery } from "@/lib/ukiki/room-list";
import { createRoom, listRooms } from "@/lib/ukiki/rooms";

// 로비 방 리스트: ?q=검색어&offset=20&mine=1
export async function GET(req: Request) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const query = parseRoomQuery({ q: sp.get("q"), offset: sp.get("offset") });
  const page = await listRooms(me, query, { mineOnly: sp.get("mine") === "1" });
  return NextResponse.json({ ok: true, ...page });
}

export async function POST(req: Request) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false, error: "로그인이 필요해요" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; visibility?: string; password?: string };
  const result = await createRoom(me, {
    name: body.name ?? "",
    visibility: body.visibility ?? "",
    password: body.password ?? null,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
