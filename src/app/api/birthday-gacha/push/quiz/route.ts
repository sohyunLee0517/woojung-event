import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/birthday-gacha/cron";
import { notifyQuizWindow } from "@/lib/birthday-gacha/notify";
import { LEGACY } from "@/lib/ukiki/legacy";

// 2시간마다 GitHub Actions 가 부른다. CRON_SECRET 이 맞아야 실행된다.
// 같은 구간에 여러 번 불려도 사람마다 한 번만 보낸다.
export async function GET(req: Request) {
  if (!isCronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!LEGACY.quizCards) return NextResponse.json({ ok: true, skipped: "legacy" });
  const result = await notifyQuizWindow();
  return NextResponse.json({ ok: true, ...result });
}
