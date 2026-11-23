import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";
import { parseKitMessage } from "@/lib/game-maker/kit";
import { endAiRound, getAiRoundState, joinAiRound, postAiEvent, setAiRoundReady, submitAiScore, tickAiRound } from "@/lib/game-maker/round-store";

type Ctx = { params: Promise<{ code: string; id: string }> };

// 상태 + after 뒤의 게임 메시지 (불러올 때 참여도 같이 한다)
export async function GET(req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const id = Number(p.id);
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  await joinAiRound(code, id, me);
  await tickAiRound(code, id); // 대기 제한 시간이 됐으면 시작하거나 노게임
  const state = await getAiRoundState(code, id, me, after);
  if (!state) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, state });
}

// { action: "ready", ready } | 게임 키트 메시지 { action: "kit", message }
export async function POST(req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const id = Number(p.id);
  const body = (await req.json().catch(() => ({}))) as { action?: string; ready?: boolean; message?: unknown };
  if (body.action === "ready") {
    await setAiRoundReady(code, id, me, body.ready !== false);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "kit") {
    const m = parseKitMessage(body.message);
    if (!m) return NextResponse.json({ ok: false }, { status: 400 });
    const ok =
      m.type === "send" ? await postAiEvent(code, id, me, m.data)
      : m.type === "score" ? await submitAiScore(code, id, me, m.value)
      : m.type === "end" ? await endAiRound(code, id, me, m.result)
      : true;
    return NextResponse.json({ ok });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
