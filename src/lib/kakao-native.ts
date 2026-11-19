// 앱의 카카오 로그인(네이티브 SDK)이 넘겨준 access token 을 카카오에 직접 물어서 확인한다.
// 다른 앱에서 받은 토큰으로 들어오지 못하게 app_id 가 우리 앱인지도 본다.
/** 카카오 개발자 콘솔의 앱 ID (공개값). 다른 앱 토큰을 막는 데 쓴다. */
export const KAKAO_APP_ID = Number(process.env.KAKAO_APP_ID ?? 0);

export type KakaoNativeProfile = { kakaoId: string; nickname: string | null; image: string | null };

type Options = { appId: number; fetchImpl?: typeof fetch };

export async function verifyKakaoAccessToken(accessToken: string, { appId, fetchImpl = fetch }: Options) {
  if (!accessToken || !appId) return null;
  const headers = { authorization: `Bearer ${accessToken}` };
  try {
    const infoRes = await fetchImpl("https://kapi.kakao.com/v1/user/access_token_info", { headers });
    if (!infoRes.ok) return null;
    const info = (await infoRes.json()) as { id?: number; app_id?: number };
    if (info.app_id !== appId || !info.id) return null;

    const meRes = await fetchImpl("https://kapi.kakao.com/v2/user/me", { headers });
    if (!meRes.ok) return null;
    const me = (await meRes.json()) as {
      id?: number;
      properties?: { nickname?: string; profile_image?: string };
      kakao_account?: { profile?: { nickname?: string; profile_image_url?: string } };
    };
    if (me.id !== info.id) return null;
    return {
      kakaoId: String(me.id),
      nickname: me.properties?.nickname ?? me.kakao_account?.profile?.nickname ?? null,
      image: me.properties?.profile_image ?? me.kakao_account?.profile?.profile_image_url ?? null,
    } satisfies KakaoNativeProfile;
  } catch {
    return null;
  }
}
