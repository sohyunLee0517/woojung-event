import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode, saveFanfareResult } from "@/lib/ukiki/rooms";

// 빵빠레 결과(탭 수) 저장 — 호스트만
export async function POST(req: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const { taps } = (await req.json().catch(() => ({}))) as { taps?: Record<string, number> };
  const ok = await saveFanfareResult(normalizeRoomCode(p.code), Number(p.id), me, taps ?? {});
  return NextResponse.json({ ok }, { status: ok ? 200 : 403 });
}
