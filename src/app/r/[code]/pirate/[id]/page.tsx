import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enterRoom, getRoomGame, normalizeRoomCode } from "@/lib/ukiki/rooms";
import { enabledGames } from "@/lib/ukiki/features";
import PirateGame from "@/components/pirate/PirateGame";

export const dynamic = "force-dynamic";

// 해적 무찌르기 한 판
export default async function PiratePage({ params }: { params: Promise<{ code: string; id: string }> }) {
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}/pirate/${p.id}`)}`);
  if ((await enterRoom(code, me)) !== "enter") redirect(`/r/${code}`);
  const game = await getRoomGame(code, Number(p.id));
  if (!game || game.game_type !== "pirate") redirect(`/r/${code}`);
  if ((await enabledGames()).pirate === false) redirect(`/r/${code}`);
  return <PirateGame roomCode={code} gameId={Number(game.id)} me={me} />;
}
