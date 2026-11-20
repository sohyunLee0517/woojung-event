import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";
import { enabledGames } from "@/lib/ukiki/features";
import { myBananas } from "@/lib/bananas/store";
import { createAiGame, listRoomAiGames } from "@/lib/game-maker/store";

type Ctx = { params: Promise<{ code: string }> };

// 방의 AI 게임 목록 (확정된 것 + 내가 만드는 중인 것) + 내 바나나
export async function GET(_req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const code = normalizeRoomCode((await params).code);
  const list = await listRoomAiGames(code, me);
  if (!list) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, ...list, balance: await myBananas(me) });
}

// 새 게임 만들기 시작 (빈 임시저장). { replace: true } 면 만들던 게임을 지우고 새로
export async function POST(req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  if ((await enabledGames()).ai === false) return NextResponse.json({ ok: false, reason: "disabled" }, { status: 403 });
  const code = normalizeRoomCode((await params).code);
  const { replace } = (await req.json().catch(() => ({}))) as { replace?: boolean };
  const r = await createAiGame(code, me, { replace: replace === true });
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === "not_member" ? 403 : 409 });
}
