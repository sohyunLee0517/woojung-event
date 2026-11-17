import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { drawCapsule, normalizeCode } from "@/lib/birthday-gacha/games";

// 뽑기권 1장으로 캡슐 하나 열기
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { code } = await params;
  const result = await drawCapsule(normalizeCode(code), me);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
