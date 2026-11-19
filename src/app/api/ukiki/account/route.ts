import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteAccount } from "@/lib/account-delete";

// 회원 탈퇴. 내가 만든 방이 남아 있으면 409 와 방 목록을 돌려준다.
export async function DELETE() {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const r = await deleteAccount(me);
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
