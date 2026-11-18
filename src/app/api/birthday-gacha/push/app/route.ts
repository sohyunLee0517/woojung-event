import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fcmEndpoint } from "@/lib/birthday-gacha/fcm-push";
import { saveSubscription } from "@/lib/birthday-gacha/push";

// 우끼끼 앱이 자기 푸시 토큰을 등록한다 (앱을 열 때마다 → 마지막 접속 기기로 갱신)
export async function POST(req: Request) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  let endpoint: string;
  try {
    endpoint = fcmEndpoint(token ?? "");
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_token" }, { status: 400 });
  }
  await saveSubscription(me, { endpoint, keys: { p256dh: "", auth: "" } }, "우끼끼 앱 (Android)");
  return NextResponse.json({ ok: true });
}
