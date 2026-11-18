import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enterRoom, getRoomGame, joinFanfare, normalizeRoomCode } from "@/lib/ukiki/rooms";
import EndFanfareButton from "@/components/ukiki/EndFanfareButton";
import { columnStyle, pageStyle } from "@/components/ukiki/styles";
import TopBar from "@/components/ukiki/TopBar";

export const dynamic = "force-dynamic";

// 빵빠레 한 판. (3단계에서 기존 빵빠레 화면을 방별로 연결한다)
export default async function FanfarePage({ params }: { params: Promise<{ code: string; id: string }> }) {
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}/fanfare/${p.id}`)}`);
  if ((await enterRoom(code, me)) !== "enter") redirect(`/r/${code}`);

  const game = await getRoomGame(code, Number(p.id));
  if (!game || game.game_type !== "fanfare") redirect(`/r/${code}`);
  const isHost = game.host_kakao_id === me;
  if (game.status === "active") await joinFanfare(code, Number(game.id), me);

  return (
    <main style={pageStyle}>
      <div style={{ ...columnStyle, minHeight: "100%" }}>
        <TopBar backHref={`/r/${code}`} title="🎉 빵빠레" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 12, paddingBottom: 80 }}>
        <p style={{ fontSize: 48 }}>🎉</p>
        <p style={{ fontSize: 20, fontWeight: 800 }}>빵빠레</p>
        {game.status === "ended" ? (
          <p style={{ opacity: 0.7 }}>끝난 빵빠레예요.</p>
        ) : (
          <p style={{ opacity: 0.8 }}>
            {isHost ? "내가 호스트예요 (카메라를 켤 사람)" : `${game.host_name ?? "친구"}님이 호스트예요`}
          </p>
        )}
        <p style={{ fontSize: 13, opacity: 0.5 }}>빵빠레 화면은 곧 연결돼요.</p>
        {isHost && game.status === "active" && <EndFanfareButton code={code} id={Number(game.id)} />}
        </div>
      </div>
    </main>
  );
}
