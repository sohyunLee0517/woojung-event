import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteSubscription, saveSubscription, type SubscriptionInput } from "@/lib/birthday-gacha/push";

export async function POST(req: Request) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const sub = (await req.json().catch(() => null)) as SubscriptionInput | null;
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ ok: false, reason: "bad_subscription" }, { status: 400 });
  }
  await saveSubscription(me, sub, req.headers.get("user-agent"));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await deleteSubscription(me, endpoint);
  return NextResponse.json({ ok: true });
}
