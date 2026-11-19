import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";
import { nudgeGame } from "@/lib/ukiki/game-push";

// 재촉하기: 아직 게임에 안 들어온 방 멤버에게 푸시. game 은 게임 번호 또는 가챠 코드.
export async function POST(_req: Request, { params }: { params: Promise<{ code: string; game: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  const p = await params;
  const game = /^\d+$/.test(p.game) ? Number(p.game) : p.game;
  const r = await nudgeGame(normalizeRoomCode(p.code), game, me);
  return NextResponse.json(r, { status: r.ok || r.reason === "cooldown" ? 200 : 403 });
}
