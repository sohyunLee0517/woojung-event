import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";
import { cutSnack, getSnackState, joinSnack, setSnackReady, tickSnack } from "@/lib/snack/store";

type Ctx = { params: Promise<{ code: string; id: string }> };

// 상태 (불러올 때 참여도 같이 한다)
export async function GET(_req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const id = Number(p.id);
  await joinSnack(code, id, me);
  await tickSnack(code, id); // 대기 제한 시간이 됐으면 시작하거나 노게임
  const state = await getSnackState(code, id, me);
  if (!state) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, state });
}

// { action: "ready", ready } | { action: "cut", amount }
export async function POST(req: Request, { params }: Ctx) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const id = Number(p.id);
  const body = (await req.json().catch(() => ({}))) as { action?: string; ready?: boolean; amount?: number };
  if (body.action === "ready") {
    await setSnackReady(code, id, me, body.ready !== false);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "cut") {
    const r = await cutSnack(code, id, me, Number(body.amount));
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
