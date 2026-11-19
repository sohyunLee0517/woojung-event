import { after, NextResponse } from "next/server";
import { notifyNewGame } from "@/lib/ukiki/game-push";
import { auth } from "@/auth";
import { cancelFanfare, createFanfare, endFanfare, normalizeRoomCode } from "@/lib/ukiki/rooms";
import { LEGACY } from "@/lib/ukiki/legacy";
import { clearFanfareRealtime } from "@/lib/firebase-admin";

// 빵빠레 열기. 이미 진행 중이면 conflict (나가기 / 참여하기)
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ kind: "unauthorized" }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const outcome = await createFanfare(code, me);
  // 새 게임 알림은 응답을 막지 않게 끝난 뒤에 보낸다
  if (outcome.kind === "created") after(() => notifyNewGame(code, outcome.id, me).catch((e) => console.error("[push] 새 게임 알림 실패", e)));
  return NextResponse.json(outcome);
}

// 빵빠레 끝내기 (호스트만). 호스트 없는 빵빠레는 시작 전 '닫기'만 방 멤버 누구나
export async function DELETE(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const { id, outcome } = (await req.json().catch(() => ({}))) as { id?: number; outcome?: string };
  const how = outcome === "aborted" || outcome === "cancelled" ? outcome : "completed";
  const ok =
    typeof id === "number" &&
    (LEGACY.fanfareHost ? await endFanfare(code, id, me, how) : how === "cancelled" && (await cancelFanfare(code, id, me)));
  if (ok) await clearFanfareRealtime(id as number).catch((e) => console.error("[fanfare] 실시간 정리 실패", e));
  return NextResponse.json({ ok });
}
