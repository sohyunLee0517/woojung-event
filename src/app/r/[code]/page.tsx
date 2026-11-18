import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enterRoom, getRoomDetail, normalizeRoomCode } from "@/lib/ukiki/rooms";
import { getSql } from "@/lib/db";
import PasswordGate from "@/components/ukiki/PasswordGate";
import RoomView from "@/components/ukiki/RoomView";
import { columnStyle, pageStyle } from "@/components/ukiki/styles";
import TopBar from "@/components/ukiki/TopBar";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code);
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(`/r/${code}`)}`);

  const entry = await enterRoom(code, me);

  if (entry === "not_found") {
    return (
      <main style={pageStyle}>
        <div style={{ ...columnStyle, minHeight: "100%" }}>
          <TopBar backHref="/" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", gap: 8, paddingBottom: 80 }}>
            <p style={{ fontSize: 40 }}>🙈</p>
            <p style={{ fontWeight: 700 }}>없는 방이에요</p>
          </div>
        </div>
      </main>
    );
  }

  if (entry !== "enter") {
    const sql = getSql();
    const rows = (await sql`select name from uk_rooms where code = ${code}`) as { name: string }[];
    return <PasswordGate code={code} name={rows[0]?.name ?? "비밀방"} />;
  }

  const room = await getRoomDetail(code, me);
  if (!room) redirect("/");
  return <RoomView initial={room} me={me} />;
}
