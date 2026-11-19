import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { normalizeCode } from "@/lib/birthday-gacha/games";
import { enabledGames } from "@/lib/ukiki/features";
import { getSql } from "@/lib/db";
import GameView from "./GameView";

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  // 초대 링크로 들어왔는데 로그인 전이면 홈에서 로그인 후 다시 이 방으로 오게 한다
  if (!session?.user?.id) redirect(`/?next=${encodeURIComponent(`/birthday-gacha/g/${code}`)}`);
  // 관리자가 생일 가챠를 꺼 두면 방(없으면 홈)으로
  if (!(await enabledGames()).gacha) {
    const rows = (await getSql()`
      select room_code from uk_room_games where game_type = 'gacha' and ref_code = ${normalizeCode(code)} limit 1
    `) as { room_code: string }[];
    redirect(rows[0] ? `/r/${rows[0].room_code}` : "/");
  }
  return <GameView code={normalizeCode(code)} />;
}
