import { redirect } from "next/navigation";
import { auth } from "@/auth";
import MapView from "@/app/birthday-gacha/map/MapView";
import { enterRoom, normalizeRoomCode } from "@/lib/ukiki/rooms";

export const dynamic = "force-dynamic";

// 방 지도: 같은 방 친구 위치만 보인다
export default async function RoomMapPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code);
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}/map`)}`);
  if ((await enterRoom(code, me)) !== "enter") redirect(`/r/${code}`);
  return <MapView roomCode={code} backHref={`/r/${code}`} backLabel="←" />;
}
