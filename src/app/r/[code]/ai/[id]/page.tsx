import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enterRoom, getRoomGame, normalizeRoomCode } from "@/lib/ukiki/rooms";
import { enabledGames } from "@/lib/ukiki/features";
import AiRoundGame from "@/components/game-maker/AiRoundGame";

export const dynamic = "force-dynamic";

// 우리가 만든 게임 한 판
export default async function AiRoundPage({ params }: { params: Promise<{ code: string; id: string }> }) {
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}/ai/${p.id}`)}`);
  if ((await enterRoom(code, me)) !== "enter") redirect(`/r/${code}`);
  const game = await getRoomGame(code, Number(p.id));
  if (!game || game.game_type !== "ai") redirect(`/r/${code}`);
  if ((await enabledGames()).ai === false) redirect(`/r/${code}`);
  return <AiRoundGame roomCode={code} gameId={Number(game.id)} me={me} />;
}
