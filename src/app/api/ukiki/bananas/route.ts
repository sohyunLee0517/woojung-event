import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { myBananas } from "@/lib/bananas/store";

// 내 바나나 (끝난 게임 보상을 정산하고 잔액)
export async function GET() {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, balance: await myBananas(me) });
}
