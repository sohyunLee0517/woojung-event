import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enterRoom, getRoomGame, joinFanfare, normalizeRoomCode } from "@/lib/ukiki/rooms";
import FanfareGame from "@/components/fanfare/FanfareGame";
import { columnStyle, pageStyle } from "@/components/ukiki/styles";
import TopBar from "@/components/ukiki/TopBar";
import { LEGACY } from "@/lib/ukiki/legacy";

export const dynamic = "force-dynamic";

// 빵빠레 한 판 (방 안에서 열린 게임)
export default async function FanfarePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; id: string }>;
  searchParams: Promise<{ devAs?: string }>;
}) {
  const p = await params;
  const { devAs } = await searchParams;
  const code = normalizeRoomCode(p.code);
  const session = await auth();
  const me = session?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}/fanfare/${p.id}`)}`);
  if ((await enterRoom(code, me)) !== "enter") redirect(`/r/${code}`);

  const game = await getRoomGame(code, Number(p.id));
  if (!game || game.game_type !== "fanfare") redirect(`/r/${code}`);

  if (game.status === "ended") {
    return (
      <main style={pageStyle}>
        <div style={{ ...columnStyle, minHeight: "100%" }}>
          <TopBar backHref={`/r/${code}`} title="🎉 빵빠레" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8, paddingBottom: 80 }}>
            <p style={{ fontSize: 40 }}>🏁</p>
            <p style={{ fontWeight: 700 }}>끝난 빵빠레예요</p>
            <p style={{ fontSize: 13, opacity: 0.6 }}>결과는 방의 &apos;지난 게임&apos;에서 볼 수 있어요</p>
          </div>
        </div>
      </main>
    );
  }

  await joinFanfare(code, Number(game.id), me);

  // 로컬 개발에서만: ?devAs=test-xxx 로 다른 친구인 척 들어가 두 명 플레이를 확인한다
  const asTestFriend = process.env.NODE_ENV !== "production" && devAs?.startsWith("test-") ? devAs : null;
  const identity = asTestFriend
    ? { id: asTestFriend, name: asTestFriend.replace(/^test-/, "테스트 "), image: null }
    : { id: me, name: session?.user?.name ?? "친구", image: session?.user?.image ?? null };

  return (
    <FanfareGame
      gameId={Number(game.id)}
      roomCode={code}
      me={identity}
      isHost={LEGACY.fanfareHost && !asTestFriend && game.host_kakao_id === me}
      hostName={game.host_name ?? "호스트"}
      devAs={asTestFriend}
    />
  );
}
