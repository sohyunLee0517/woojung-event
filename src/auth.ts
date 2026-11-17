import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";

// AUTH_KAKAO_ID / AUTH_KAKAO_SECRET 환경 변수를 자동으로 읽는다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Kakao],
});
