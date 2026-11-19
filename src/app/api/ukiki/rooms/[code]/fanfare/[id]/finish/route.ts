import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { finishFanfare, normalizeRoomCode } from "@/lib/ukiki/rooms";

// 호스트 없는 빵빠레: 순위가 나오면 참여자 누구나 결과(탭 수)를 저장하고 끝낸다
export async function POST(req: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const { taps } = (await req.json().catch(() => ({}))) as { taps?: Record<string, number> };
  const ok = await finishFanfare(normalizeRoomCode(p.code), Number(p.id), me, taps ?? {});
  return NextResponse.json({ ok }, { status: ok ? 200 : 403 });
}
