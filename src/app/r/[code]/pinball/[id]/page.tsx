import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enterRoom, getRoomGame, normalizeRoomCode } from "@/lib/ukiki/rooms";
import { enabledGames } from "@/lib/ukiki/features";
import PinballGame from "@/components/pinball/PinballGame";

export const dynamic = "force-dynamic";

// 랜덤 핀볼 한 판
export default async function PinballPage({ params }: { params: Promise<{ code: string; id: string }> }) {
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}/pinball/${p.id}`)}`);
  if ((await enterRoom(code, me)) !== "enter") redirect(`/r/${code}`);
  const game = await getRoomGame(code, Number(p.id));
  if (!game || game.game_type !== "pinball") redirect(`/r/${code}`);
  if ((await enabledGames()).pinball === false) redirect(`/r/${code}`);
  return <PinballGame roomCode={code} gameId={Number(game.id)} me={me} />;
}
