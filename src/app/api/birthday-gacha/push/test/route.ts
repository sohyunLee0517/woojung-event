import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeCode } from "@/lib/birthday-gacha/games";
import { sendTestPush } from "@/lib/birthday-gacha/notify";

export async function POST(req: Request) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const devices = await sendTestPush(me, normalizeCode(code ?? ""));
  return NextResponse.json({ ok: devices > 0, devices });
}
