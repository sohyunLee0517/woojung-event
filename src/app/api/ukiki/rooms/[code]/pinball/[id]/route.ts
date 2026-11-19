import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";
import { getPinballState, joinPinball, setPinballReady } from "@/lib/pinball/store";

type Ctx = { params: Promise<{ code: string; id: string }> };

// 상태 (불러올 때 참여도 같이 한다)
export async function GET(_req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const id = Number(p.id);
  await joinPinball(code, id, me);
  const state = await getPinballState(code, id, me);
  if (!state) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, state });
}

// { action: "ready", ready }
export async function POST(req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const id = Number(p.id);
  const body = (await req.json().catch(() => ({}))) as { action?: string; ready?: boolean };
  if (body.action === "ready") {
    await setPinballReady(code, id, me, body.ready !== false);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
