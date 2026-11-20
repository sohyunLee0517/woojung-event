import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";
import { notifyNewGame } from "@/lib/ukiki/game-push";
import { createAiRound } from "@/lib/game-maker/round-store";

// 우리가 만든 게임 한 판 열기 { aiGameId } (방마다 하나)
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ kind: "unauthorized" }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const { aiGameId } = (await req.json().catch(() => ({}))) as { aiGameId?: number };
  const outcome = await createAiRound(code, me, Number(aiGameId));
  if (outcome.kind === "created") after(() => notifyNewGame(code, outcome.id, me).catch((e) => console.error("[push] 새 게임 알림 실패", e)));
  const status = outcome.kind === "not_member" || outcome.kind === "disabled" ? 403 : outcome.kind === "not_found" ? 404 : 200;
  return NextResponse.json(outcome, { status });
}
