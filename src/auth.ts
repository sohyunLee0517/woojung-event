import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";
import Credentials from "next-auth/providers/credentials";
import { KAKAO_APP_ID, verifyKakaoAccessToken } from "@/lib/kakao-native";
import { upsertPlayer } from "@/lib/players";

// AUTH_KAKAO_ID / AUTH_KAKAO_SECRET 환경 변수를 자동으로 읽는다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Kakao,
    // 우끼끼 앱: 카카오톡 앱으로 로그인(네이티브 SDK)한 access token 을 카카오에 확인하고 들어온다
    Credentials({
      id: "kakao-native",
      credentials: { accessToken: {} },
      async authorize(c) {
        const p = await verifyKakaoAccessToken(String(c?.accessToken ?? ""), { appId: KAKAO_APP_ID });
        return p ? { id: p.kakaoId, name: p.nickname, image: p.image } : null;
      },
    }),
  ],
  callbacks: {
    // 카카오 로그인이 끝날 때마다 플레이어를 DB에 저장(또는 갱신)한다.
    async signIn({ user, account }) {
      const kakaoId = account?.provider === "kakao" ? account.providerAccountId : account?.provider === "kakao-native" ? user.id : null;
      if (kakaoId) {
        try {
          await upsertPlayer({
            kakaoId,
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
    jwt({ token, account, user }) {
      if (account?.provider === "kakao") token.kakaoId = account.providerAccountId;
      if (account?.provider === "kakao-native" && user?.id) token.kakaoId = user.id;
      return token;
    },
    // 화면에서 카카오 계정 ID를 쓸 수 있게 session.user.id 에 넣는다.
    session({ session, token }) {
      if (typeof token.kakaoId === "string") session.user.id = token.kakaoId;
      return session;
    },
  },
});
