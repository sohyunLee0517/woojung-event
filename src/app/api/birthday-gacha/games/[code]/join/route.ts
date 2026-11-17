import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { joinGame, normalizeCode } from "@/lib/birthday-gacha/games";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { code } = await params;
  const result = await joinGame(normalizeCode(code), me);
  const status = result === "not_found" ? 404 : result === "full" ? 409 : 200;
  return NextResponse.json({ result }, { status });
}
