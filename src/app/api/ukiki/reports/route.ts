import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createReport } from "@/lib/ukiki/reports";

// 앱 안 신고하기
export async function POST(req: Request) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false, error: "로그인이 필요해요" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { category?: string; body?: string; roomCode?: string | null; aiGameId?: number | null };
  const r = await createReport(me, { category: body.category ?? "", body: body.body ?? "", roomCode: body.roomCode ?? null, aiGameId: body.aiGameId ?? null });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
