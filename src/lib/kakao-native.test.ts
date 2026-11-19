import { describe, expect, it, vi } from "vitest";
import { verifyKakaoAccessToken } from "./kakao-native";

// 앱의 카카오 로그인(네이티브)이 넘겨준 access token 을 카카오에 직접 물어서 확인한다.
const APP_ID = 1234;

function fakeFetch(routes: Record<string, { status: number; body: unknown }>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const key = String(url);
    const r = routes[key];
    if (!r) throw new Error(`unexpected ${key}`);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer tok");
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
}

const INFO = "https://kapi.kakao.com/v1/user/access_token_info";
const ME = "https://kapi.kakao.com/v2/user/me";

describe("verifyKakaoAccessToken", () => {
  it("우리 앱 토큰이면 카카오 계정 ID·닉네임·사진을 돌려준다", async () => {
    const f = fakeFetch({
      [INFO]: { status: 200, body: { id: 987, app_id: APP_ID, expires_in: 100 } },
      [ME]: {
        status: 200,
        body: { id: 987, properties: { nickname: "소현", profile_image: "https://img/p.jpg" } },
      },
    });
    expect(await verifyKakaoAccessToken("tok", { appId: APP_ID, fetchImpl: f })).toEqual({
      kakaoId: "987",
      nickname: "소현",
      image: "https://img/p.jpg",
    });
  });

  it("다른 앱에서 발급된 토큰이면 거절한다", async () => {
    const f = fakeFetch({ [INFO]: { status: 200, body: { id: 987, app_id: 5555, expires_in: 100 } } });
    expect(await verifyKakaoAccessToken("tok", { appId: APP_ID, fetchImpl: f })).toBeNull();
  });

  it("만료·잘못된 토큰(401)이면 거절한다", async () => {
    const f = fakeFetch({ [INFO]: { status: 401, body: { code: -401 } } });
    expect(await verifyKakaoAccessToken("tok", { appId: APP_ID, fetchImpl: f })).toBeNull();
  });

  it("토큰 주인과 사용자 정보가 다르면 거절한다", async () => {
    const f = fakeFetch({
      [INFO]: { status: 200, body: { id: 987, app_id: APP_ID } },
      [ME]: { status: 200, body: { id: 111 } },
    });
    expect(await verifyKakaoAccessToken("tok", { appId: APP_ID, fetchImpl: f })).toBeNull();
  });

  it("토큰이 비었거나 앱 ID 설정이 없으면 카카오에 묻지도 않고 거절한다", async () => {
    const f = vi.fn();
    expect(await verifyKakaoAccessToken("", { appId: APP_ID, fetchImpl: f })).toBeNull();
    expect(await verifyKakaoAccessToken("tok", { appId: 0, fetchImpl: f })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("카카오 서버가 죽어 있어도 예외 대신 거절한다", async () => {
    const f = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await verifyKakaoAccessToken("tok", { appId: APP_ID, fetchImpl: f })).toBeNull();
  });
});
