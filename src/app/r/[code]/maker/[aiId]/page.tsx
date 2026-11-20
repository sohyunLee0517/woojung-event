import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enterRoom, normalizeRoomCode } from "@/lib/ukiki/rooms";
import { enabledGames } from "@/lib/ukiki/features";
import MakerEditor from "@/components/game-maker/MakerEditor";

export const dynamic = "force-dynamic";

// AI 게임 만들기·고치기 (만든 사람만)
export default async function MakerEditPage({ params }: { params: Promise<{ code: string; aiId: string }> }) {
  const p = await params;
  const code = normalizeRoomCode(p.code);
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}/maker/${p.aiId}`)}`);
  if ((await enterRoom(code, me)) !== "enter") redirect(`/r/${code}`);
  if ((await enabledGames()).ai === false) redirect(`/r/${code}`);
  return <MakerEditor roomCode={code} aiId={Number(p.aiId)} />;
}
