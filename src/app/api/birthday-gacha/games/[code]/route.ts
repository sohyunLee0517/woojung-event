import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGameState, normalizeCode } from "@/lib/birthday-gacha/games";

// 방 상태 (플레이어, 남은 캡슐 수, 뽑힌 캡슐)
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { code } = await params;
  const state = await getGameState(normalizeCode(code), me);
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(state);
}
