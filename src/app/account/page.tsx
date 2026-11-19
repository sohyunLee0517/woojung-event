import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ownedRooms } from "@/lib/ukiki/rooms";
import TopBar from "@/components/ukiki/TopBar";
import { columnStyle, pageStyle } from "@/components/ukiki/styles";
import AccountDelete from "./AccountDelete";

export const dynamic = "force-dynamic";
export const metadata = { title: "회원 탈퇴 · 우끼끼" };

export default async function AccountPage() {
  const me = (await auth())?.user?.id;
  if (!me) redirect("/?next=/account");
  const rooms = await ownedRooms(me);
  return (
    <main style={pageStyle}>
      <div style={{ ...columnStyle, minHeight: "100%" }}>
        <TopBar backHref="/" title="회원 탈퇴" />
        <AccountDelete ownedCount={rooms.length} />
      </div>
    </main>
  );
}
