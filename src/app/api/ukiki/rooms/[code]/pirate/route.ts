import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";
import { createPirate } from "@/lib/pirate/store";
import { notifyNewGame } from "@/lib/ukiki/game-push";

// 해적 무찌르기 열기 (방마다 하나)
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ kind: "unauthorized" }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const outcome = await createPirate(code, me);
  if (outcome.kind === "created") after(() => notifyNewGame(code, outcome.id, me).catch((e) => console.error("[push] 새 게임 알림 실패", e)));
  const status = outcome.kind === "not_member" || outcome.kind === "disabled" ? 403 : 200;
  return NextResponse.json(outcome, { status });
}
