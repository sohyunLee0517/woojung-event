import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { firebaseAdminReady, issueFanfareToken } from "@/lib/firebase-admin";
import { enterRoom, getRoomGame, normalizeRoomCode } from "@/lib/ukiki/rooms";

// 빵빠레 실시간 입장권. 카카오 로그인 + 방 멤버 + 진행 중인 빵빠레일 때만 준다.
export async function POST(req: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const me = (await auth())?.user?.id;
  if (!me) return NextResponse.json({ ok: false, reason: "login" }, { status: 401 });
  const p = await params;
  const code = normalizeRoomCode(p.code);
  if ((await enterRoom(code, me)) !== "enter") return NextResponse.json({ ok: false, reason: "not_member" }, { status: 403 });
  const game = await getRoomGame(code, Number(p.id));
  if (!game || game.game_type !== "fanfare" || game.status !== "active") {
    return NextResponse.json({ ok: false, reason: "not_active" }, { status: 404 });
  }
  if (!firebaseAdminReady()) return NextResponse.json({ ok: false, reason: "server_not_ready" }, { status: 503 });

  // 로컬 개발에서만: 다른 친구인 척 (두 명 플레이 확인용)
  const { devAs } = (await req.json().catch(() => ({}))) as { devAs?: string };
  const uid = process.env.NODE_ENV !== "production" && devAs?.startsWith("test-") ? devAs : me;

  const token = await issueFanfareToken(Number(game.id), game.host_kakao_id, uid);
  return NextResponse.json({ ok: true, token, uid });
}
