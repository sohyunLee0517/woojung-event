import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth, signIn, signOut } from "@/auth";
import { createGame, listMyGames, normalizeCode } from "@/lib/birthday-gacha/games";
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

async function loadMyGames(kakaoId?: string) {
  if (!kakaoId) return [];
  try {
    return await listMyGames(kakaoId);
  } catch (error) {
    console.error("[games] 방 목록 조회 실패", error);
    return [];
  }
}

// 초대 링크로 왔다가 로그인하면 그 방으로 돌려보낸다 (사이트 밖 주소는 무시)
function safeNext(next?: string) {
  return next && next.startsWith("/birthday-gacha/") ? next : "/birthday-gacha";
}

const yellowButton: CSSProperties = {
  padding: "14px 24px",
  background: "#FEE500",
  color: "#191919",
  border: "none",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "center",
};

const darkButton: CSSProperties = {
  padding: "12px 16px",
  background: "rgba(255,255,255,.1)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  cursor: "pointer",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await auth();
  const user = session?.user;

  // 로그인한 상태로 초대 링크에서 넘어왔으면 바로 방으로
  if (user?.id && next) redirect(safeNext(next));

  const [player, games] = await Promise.all([loadPlayer(user?.id), loadMyGames(user?.id)]);

  return (
    <main
      style={{
        height: "100%",
        overflowY: "auto",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          minHeight: "100%",
          margin: "0 auto",
          padding: "32px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 900, textAlign: "center" }}>🎂 생일 가챠</h1>

        {user ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
              {user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image.replace(/^http:\/\//, "https://")}
                  alt="프로필 사진"
                  width={48}
                  height={48}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              )}
              <div>
                <p style={{ fontSize: 18, fontWeight: 700 }}>{user.name ?? "닉네임 없음"}님, 반가워요!</p>
                <p style={{ fontSize: 12, opacity: 0.6 }}>
                  {player ? `로그인 ${player.login_count}회` : "플레이어 정보가 아직 저장되지 않았어요"}
                </p>
              </div>
            </div>

            <form
              action={async () => {
                "use server";
                const s = await auth();
                if (!s?.user?.id) redirect("/birthday-gacha");
                const code = await createGame(s.user.id);
                redirect(`/birthday-gacha/g/${code}`);
              }}
              style={{ display: "flex" }}
            >
              <button type="submit" style={{ ...yellowButton, flex: 1 }}>
                🎰 새 게임 방 만들기
              </button>
            </form>

            <form
              action={async (formData: FormData) => {
                "use server";
                const code = normalizeCode(String(formData.get("code") ?? ""));
                if (code) redirect(`/birthday-gacha/g/${code}`);
              }}
              style={{ display: "flex", gap: 8 }}
            >
              <input
                name="code"
                placeholder="방 코드 6자리"
                maxLength={6}
                autoCapitalize="characters"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.2)",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 16,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              />
              <button type="submit" style={darkButton}>
                참가
              </button>
            </form>

            {games.length > 0 && (
              <section>
                <h2 style={{ fontSize: 14, opacity: 0.7, margin: "8px 0" }}>내 방</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {games.map((g) => (
                    <Link
                      key={g.code}
                      href={`/birthday-gacha/g/${g.code}`}
                      style={{ ...darkButton, display: "flex", justifyContent: "space-between" }}
                    >
                      <span style={{ fontWeight: 700, letterSpacing: 2 }}>{g.code}</span>
                      <span style={{ opacity: 0.7 }}>👥 {g.players}/3 →</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
              <Link href="/birthday-gacha/map" style={darkButton}>
                🗺️ 지도
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/birthday-gacha" });
                }}
              >
                <button type="submit" style={darkButton}>
                  로그아웃
                </button>
              </form>
            </div>
          </>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("kakao", { redirectTo: safeNext(next) });
            }}
            style={{ display: "flex" }}
          >
            <button type="submit" style={{ ...yellowButton, flex: 1 }}>
              카카오로 시작하기
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
