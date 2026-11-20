import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";
import { enabledGames } from "@/lib/ukiki/features";
import { myBananas } from "@/lib/bananas/store";
import { deleteAiGame, getAiGameForEdit, loadAiGame, publishAiGame } from "@/lib/game-maker/store";
import { finishGamePrompt, startGamePrompt } from "@/lib/game-maker/generate";

// AI 가 게임을 만드는 동안(1~3분) 함수가 살아 있게
export const maxDuration = 300;

type Ctx = { params: Promise<{ code: string; aiId: string }> };

async function load(code: string, id: number, me: string) {
  const g = await getAiGameForEdit(id, me);
  return g && g.roomCode === code ? g : null;
}

// 만들던 게임(임시저장) — 만든 사람만. 확정한 게임은 더 고칠 수 없어서 404
export async function GET(_req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const game = await load(normalizeRoomCode(p.code), Number(p.aiId), me);
  if (!game) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, game, balance: await myBananas(me) });
}

// { action: "prompt", prompt } | { action: "publish", version } (만들던 게임만) | { action: "delete" }
export async function POST(req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const id = Number(p.aiId);
  const body = (await req.json().catch(() => ({}))) as { action?: string; prompt?: string; version?: number };

  // 지우기: 만든 사람만 (만들던 게임이든 확정한 게임이든)
  if (body.action === "delete") {
    const g = await loadAiGame(id);
    if (!g || g.room_code !== code) return NextResponse.json({ ok: false }, { status: 404 });
    const r = await deleteAiGame(id, me);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  if (!(await load(code, id, me))) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  if (body.action === "prompt") {
    if ((await enabledGames()).ai === false) return NextResponse.json({ ok: false, reason: "disabled" }, { status: 403 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, reason: "not_ready" }, { status: 503 });
    const r = await startGamePrompt(id, me, body.prompt ?? "");
    if (r.ok) after(() => finishGamePrompt(id, me));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (body.action === "publish") {
    const r = await publishAiGame(id, me, Number(body.version));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
