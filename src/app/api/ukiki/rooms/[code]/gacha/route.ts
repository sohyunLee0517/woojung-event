import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGachaInRoom, normalizeRoomCode } from "@/lib/ukiki/rooms";

// 방 안에서 생일 가챠 한 판 열기 (이미 열려 있으면 conflict)
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const outcome = await createGachaInRoom(code, me);
  if (outcome.kind === "not_member") return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, ...outcome });
}
