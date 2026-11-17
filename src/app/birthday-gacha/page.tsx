import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();
  const user = session?.user;

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
