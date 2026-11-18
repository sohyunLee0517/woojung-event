import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPastGames, normalizeRoomCode } from "@/lib/ukiki/rooms";

// 지난 게임 (?offset=20 으로 더보기)
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const offset = Number(new URL(req.url).searchParams.get("offset") ?? 0) || 0;
  const page = await listPastGames(code, me, offset);
  if (!page) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, ...page });
}
