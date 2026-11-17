import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";
import { upsertPlayer } from "@/lib/players";

// AUTH_KAKAO_ID / AUTH_KAKAO_SECRET 환경 변수를 자동으로 읽는다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Kakao],
  callbacks: {
    // 카카오 로그인이 끝날 때마다 플레이어를 DB에 저장(또는 갱신)한다.
    async signIn({ user, account }) {
      if (account?.provider === "kakao") {
        try {
          await upsertPlayer({
            kakaoId: account.providerAccountId,
            nickname: user.name ?? null,
            profileImage: user.image ?? null,
          });
        } catch (error) {
          // DB 오류로 로그인 자체가 막히지 않도록 기록만 남긴다.
          console.error("[players] 플레이어 저장 실패", error);
        }
      }
      return true;
    },
    // Auth.js 는 DB 어댑터 없이 쓰면 user.id 를 임의 UUID 로 만든다.
    // 로그인 순간의 카카오 계정 ID를 토큰에 따로 담아 둔다.
    jwt({ token, account }) {
      if (account?.provider === "kakao") token.kakaoId = account.providerAccountId;
      return token;
    },
    // 화면에서 카카오 계정 ID를 쓸 수 있게 session.user.id 에 넣는다.
    session({ session, token }) {
      if (typeof token.kakaoId === "string") session.user.id = token.kakaoId;
      return session;
    },
  },
});
