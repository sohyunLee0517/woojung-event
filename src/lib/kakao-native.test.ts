import { describe, expect, it, vi } from "vitest";
import { kakaoAppId, verifyKakaoAccessToken } from "./kakao-native";

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

describe("verifyKakaoAccessToken 거절 이유", () => {
  async function reasonOf(token: string, appId: number, f: typeof fetch) {
    let reason: string | null = null;
    await verifyKakaoAccessToken(token, { appId, fetchImpl: f, onReject: (r) => (reason = r) });
    return reason;
  }

  it("왜 거절했는지 짧은 코드로 알려 준다 (휴대폰에서 원인 확인용)", async () => {
    const never = vi.fn() as unknown as typeof fetch;
    expect(await reasonOf("", APP_ID, never)).toBe("no_token");
    expect(await reasonOf("tok", 0, never)).toBe("no_app_id");
    expect(await reasonOf("tok", APP_ID, fakeFetch({ [INFO]: { status: 401, body: {} } }))).toBe("info_401");
    expect(await reasonOf("tok", APP_ID, fakeFetch({ [INFO]: { status: 200, body: { id: 1, app_id: 999 } } }))).toBe(
      "app_id_999",
    );
    expect(
      await reasonOf(
        "tok",
        APP_ID,
        fakeFetch({ [INFO]: { status: 200, body: { id: 1, app_id: APP_ID } }, [ME]: { status: 403, body: {} } }),
      ),
    ).toBe("me_403");
    expect(
      await reasonOf(
        "tok",
        APP_ID,
        fakeFetch({ [INFO]: { status: 200, body: { id: 1, app_id: APP_ID } }, [ME]: { status: 200, body: { id: 2 } } }),
      ),
    ).toBe("id_mismatch");
    const boom = vi.fn(async () => {
      throw new Error("x");
    }) as unknown as typeof fetch;
    expect(await reasonOf("tok", APP_ID, boom)).toBe("network");
  });
});

describe("kakaoAppId", () => {
  it("환경 변수가 없거나 이상해도 우끼끼 카카오 앱 ID(공개값)를 쓴다", () => {
    expect(kakaoAppId(undefined)).toBe(1654459);
    expect(kakaoAppId("")).toBe(1654459);
    expect(kakaoAppId('"1654459"')).toBe(1654459);
    expect(kakaoAppId(" 1654459\n")).toBe(1654459);
    expect(kakaoAppId("777")).toBe(777);
  });
});
