import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signLocationToken } from "@/lib/app-location-token";

// 우끼끼 앱이 꺼져 있을 때도 위치를 보낼 수 있게 앱 전용 위치 토큰을 준다 (위치 저장에만 쓰임)
export async function POST() {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, token: signLocationToken(me, process.env.AUTH_SECRET ?? "") });
}
