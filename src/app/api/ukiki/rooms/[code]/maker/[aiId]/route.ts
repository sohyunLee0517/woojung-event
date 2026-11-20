import { after, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";
import { enabledGames } from "@/lib/ukiki/features";
import { myBananas } from "@/lib/bananas/store";
import { deleteAiGame, getAiGameForEdit, loadAiGame, publishAiGame, recordTestResult } from "@/lib/game-maker/store";
import { finishGamePrompt, startAutoFix, startGamePrompt } from "@/lib/game-maker/generate";

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

// { action: "prompt", prompt } | { action: "test_result", version, ok, problems } | { action: "autofix", version, problems }
// | { action: "publish", version } (테스트를 통과한 버전만) | { action: "delete" }
export async function POST(req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const id = Number(p.aiId);
  const body = (await req.json().catch(() => ({}))) as { action?: string; prompt?: string; version?: number; ok?: boolean; problems?: unknown };
  const problems = Array.isArray(body.problems) ? body.problems.filter((p): p is string => typeof p === "string") : [];

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
  // 확정 전 자동 테스트 결과 (만든 사람 화면에서 돌린 결과)
  if (body.action === "test_result") {
    await recordTestResult(id, me, Number(body.version), { ok: body.ok === true, problems });
    return NextResponse.json({ ok: true });
  }
  // 자동 테스트에서 문제가 나오면 AI 자동 수정 (바나나 없음, 최대 3번)
  if (body.action === "autofix") {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, reason: "not_ready" }, { status: 503 });
    const r = await startAutoFix(id, me, Number(body.version), problems);
    if (r.ok) after(() => finishGamePrompt(id, me));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (body.action === "publish") {
    const r = await publishAiGame(id, me, Number(body.version));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
