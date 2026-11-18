import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { adminIds, isAdmin } from "@/lib/birthday-gacha/admin";
import { safeNextPath } from "@/lib/ukiki/nav";
import { listRooms, type RoomPage } from "@/lib/ukiki/rooms";
import RoomBrowser from "@/components/ukiki/RoomBrowser";
import CreateRoomForm from "@/components/ukiki/CreateRoomForm";
import ProfileMenu from "@/components/ukiki/ProfileMenu";
import { columnStyle, fixedColumnStyle, fixedPageStyle, pageStyle, primaryButton } from "@/components/ukiki/styles";

const iconLink = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  background: "rgba(255,255,255,.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  textDecoration: "none",
  flex: "0 0 auto",
} as const;

async function loadRooms(me?: string): Promise<RoomPage | null> {
  if (!me) return null;
  try {
    return await listRooms(me);
  } catch (error) {
    console.error("[ukiki] 방 목록 조회 실패", error);
    return { items: [], hasMore: false, nextOffset: null };
  }
}

export default async function Lobby({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const session = await auth();
  const user = session?.user;

  // 초대 링크로 왔다가 로그인했으면 그 화면으로
  if (user?.id && next) redirect(safeNextPath(next));

  const rooms = await loadRooms(user?.id);

  return (
    <main style={user ? fixedPageStyle : pageStyle}>
      <div style={user ? fixedColumnStyle : { ...columnStyle, minHeight: "100%", justifyContent: "center" }}>
        {!user ? (
          <>
          <header style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: 44 }}>🐵</p>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>우끼끼</h1>
            <p style={{ fontSize: 14, opacity: 0.6 }}>우리끼리 하는 미니게임 천국</p>
          </header>
          <form
            action={async () => {
              "use server";
              await signIn("kakao", { redirectTo: safeNextPath(next) });
            }}
            style={{ display: "flex" }}
          >
            <button type="submit" style={{ ...primaryButton, flex: 1 }}>
              카카오로 입장하기
            </button>
          </form>
          </>
        ) : (
          <>
            <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ProfileMenu
                name={user.name ?? "친구"}
                image={user.image ?? null}
                logout={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              />
              {isAdmin(user.id, adminIds()) && (
                <Link href="/birthday-gacha/admin" aria-label="관리자" title="관리자" style={iconLink}>
                  🛠
                </Link>
              )}
              <CreateRoomForm />
            </header>

            {rooms && <RoomBrowser initial={rooms} />}
          </>
        )}
      </div>
    </main>
  );
}
