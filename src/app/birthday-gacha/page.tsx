import { auth, signIn, signOut } from "@/auth";
import { getPlayer, type Player } from "@/lib/players";

async function loadPlayer(kakaoId?: string): Promise<Player | null> {
  if (!kakaoId) return null;
  try {
    return await getPlayer(kakaoId);
  } catch (error) {
    console.error("[players] 플레이어 조회 실패", error);
    return null;
  }
}

export default async function Home() {
  const session = await auth();
  const user = session?.user;
  const player = await loadPlayer(user?.id);
  return (
    <main
      style={{
        height: "100%",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "sans-serif",
      }}
    >
      {user ? (
        <>
          {user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt="프로필 사진"
              width={96}
              height={96}
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          )}
          <p style={{ fontSize: 20, fontWeight: 600 }}>
            {user.name ?? "닉네임 없음"}님, 반가워요!
          </p>
          <p style={{ fontSize: 13, opacity: 0.6 }}>
            {player
              ? `플레이어 저장됨 · 로그인 ${player.login_count}회`
              : "플레이어 정보가 아직 저장되지 않았어요"}          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/birthday-gacha" });
            }}
          >
            <button type="submit" style={{ padding: "8px 16px" }}>
              로그아웃
            </button>
          </form>
        </>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("kakao", { redirectTo: "/birthday-gacha" });
          }}
        >
          <button
            type="submit"
            style={{
              padding: "12px 24px",
              background: "#FEE500",
              color: "#191919",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            카카오로 시작하기
          </button>
        </form>
      )}
    </main>
  );
}
