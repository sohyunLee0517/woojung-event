import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { normalizeCode } from "@/lib/birthday-gacha/games";
import GameView from "./GameView";

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  // 초대 링크로 들어왔는데 로그인 전이면 홈에서 로그인 후 다시 이 방으로 오게 한다
  if (!session?.user?.id) redirect(`/?next=${encodeURIComponent(`/birthday-gacha/g/${code}`)}`);
  return <GameView code={normalizeCode(code)} />;
}
