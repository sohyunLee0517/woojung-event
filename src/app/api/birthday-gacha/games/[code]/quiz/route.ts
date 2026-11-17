import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeCode } from "@/lib/birthday-gacha/games";
import { answerQuiz, startQuiz } from "@/lib/birthday-gacha/quiz";

// body: { action: "start" } → 이번 구간 문제 받기
//       { action: "answer", choice: 0~3 } → 답 제출
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { code } = await params;
  const gameCode = normalizeCode(code);
  const body = (await request.json().catch(() => null)) as { action?: string; choice?: unknown } | null;

  if (body?.action === "start") {
    const result = await startQuiz(gameCode, me);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  }
  if (body?.action === "answer") {
    const choice = Number(body.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) {
      return NextResponse.json({ error: "invalid choice" }, { status: 400 });
    }
    const result = await answerQuiz(gameCode, me, choice);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  }
  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
