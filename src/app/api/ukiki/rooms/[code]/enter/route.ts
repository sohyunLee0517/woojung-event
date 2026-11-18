import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enterRoom, normalizeRoomCode } from "@/lib/ukiki/rooms";

// 비밀방 비밀번호 확인
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const result = await enterRoom(code, me, password ?? "");
  return NextResponse.json({ ok: result === "enter", result });
}
