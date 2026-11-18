import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createFanfare, endFanfare, normalizeRoomCode } from "@/lib/ukiki/rooms";
import { clearFanfareRealtime } from "@/lib/firebase-admin";

// 빵빠레 열기. 이미 진행 중이면 conflict (나가기 / 참여하기)
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ kind: "unauthorized" }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  return NextResponse.json(await createFanfare(code, me));
}

// 빵빠레 끝내기 (호스트만)
export async function DELETE(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const { id, outcome } = (await req.json().catch(() => ({}))) as { id?: number; outcome?: string };
  const how = outcome === "aborted" || outcome === "cancelled" ? outcome : "completed";
  const ok = typeof id === "number" && (await endFanfare(code, id, me, how));
  if (ok) await clearFanfareRealtime(id as number).catch((e) => console.error("[fanfare] 실시간 정리 실패", e));
  return NextResponse.json({ ok });
}
