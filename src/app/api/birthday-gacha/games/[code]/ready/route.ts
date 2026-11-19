import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeCode, setGachaReady } from "@/lib/birthday-gacha/games";

// 준비완료 (모두 준비되면 3·2·1 뒤 시작)
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { ready } = (await req.json().catch(() => ({}))) as { ready?: boolean };
  await setGachaReady(normalizeCode((await params).code), me, ready !== false);
  return NextResponse.json({ ok: true });
}
