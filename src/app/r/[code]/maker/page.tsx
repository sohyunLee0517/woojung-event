import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enterRoom, normalizeRoomCode } from "@/lib/ukiki/rooms";
import { enabledGames } from "@/lib/ukiki/features";
import MakerHome from "@/components/game-maker/MakerHome";

export const dynamic = "force-dynamic";

// 우리가 만든 게임 (방 전용)
export default async function MakerPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code);
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}/maker`)}`);
  if ((await enterRoom(code, me)) !== "enter") redirect(`/r/${code}`);
  if ((await enabledGames()).ai === false) redirect(`/r/${code}`);
  return <MakerHome roomCode={code} me={me} />;
}
