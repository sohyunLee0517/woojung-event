import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enterRoom, getRoomGame, normalizeRoomCode } from "@/lib/ukiki/rooms";
import { enabledGames } from "@/lib/ukiki/features";
import SnackGame from "@/components/snack/SnackGame";

export const dynamic = "force-dynamic";

// 과자 나눠먹기 한 판
export default async function SnackPage({ params }: { params: Promise<{ code: string; id: string }> }) {
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}/snack/${p.id}`)}`);
  if ((await enterRoom(code, me)) !== "enter") redirect(`/r/${code}`);
  const game = await getRoomGame(code, Number(p.id));
  if (!game || game.game_type !== "snack") redirect(`/r/${code}`);
  if ((await enabledGames()).snack === false) redirect(`/r/${code}`);
  return <SnackGame roomCode={code} gameId={Number(game.id)} me={me} />;
}
