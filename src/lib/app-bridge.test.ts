import { describe, expect, it } from "vitest";
import { parseAppInfo } from "./app-bridge";

describe("parseAppInfo (우끼끼 앱 안에서 열렸는지)", () => {
  it("웹 브라우저면 null", () => {
    expect(parseAppInfo(undefined)).toBeNull();
    expect(parseAppInfo({})).toBeNull();
  });

  it("앱이 넣어 준 정보를 읽는다", () => {
    const w = { ReactNativeWebView: { injectedObjectJson: () => JSON.stringify({ app: "ukiki", platform: "android", pushToken: "ExponentPushToken[x]" }) } };
    expect(parseAppInfo(w)).toEqual({ platform: "android", pushToken: "ExponentPushToken[x]", nativeLogin: false });
  });

  it("알림을 허용 안 했으면 토큰 없이", () => {
    const w = { ReactNativeWebView: { injectedObjectJson: () => JSON.stringify({ app: "ukiki", platform: "android", pushToken: null }) } };
    expect(parseAppInfo(w)).toEqual({ platform: "android", pushToken: null, nativeLogin: false });
  });

  it("다른 앱의 웹뷰거나 깨진 값이면 null", () => {
    expect(parseAppInfo({ ReactNativeWebView: { injectedObjectJson: () => "{oops" } })).toBeNull();
    expect(parseAppInfo({ ReactNativeWebView: { injectedObjectJson: () => JSON.stringify({ app: "other" }) } })).toBeNull();
  });

  it("새 앱(2.0~)은 카카오 앱 로그인을 지원한다고 알려 준다", () => {
    const w = { ReactNativeWebView: { injectedObjectJson: () => JSON.stringify({ app: "ukiki", platform: "ios", pushToken: null, nativeLogin: true }) } };
    expect(parseAppInfo(w)).toEqual({ platform: "ios", pushToken: null, nativeLogin: true });
  });
});

describe("앱과 메시지 주고받기", () => {
  it("postToApp 은 앱 웹뷰로 JSON 메시지를 보낸다 (브라우저면 false)", async () => {
    const { postToApp } = await import("./app-bridge");
    const sent: string[] = [];
    const w = { ReactNativeWebView: { postMessage: (m: string) => sent.push(m) } };
    expect(postToApp({ type: "logout" }, w)).toBe(true);
    expect(JSON.parse(sent[0])).toEqual({ type: "logout" });
    expect(postToApp({ type: "logout" }, {})).toBe(false);
  });

  it("카카오 앱 로그인을 부탁하면 앱이 돌려준 토큰으로 끝난다", async () => {
    const { requestNativeKakaoLogin } = await import("./app-bridge");
    const sent: string[] = [];
    const w: Record<string, unknown> = { ReactNativeWebView: { postMessage: (m: string) => sent.push(m) } };
    const p = requestNativeKakaoLogin(w);
    expect(JSON.parse(sent[0])).toEqual({ type: "kakaoLogin" });
    (w.__ukikiKakao as (r: unknown) => void)({ accessToken: "tok" });
    await expect(p).resolves.toEqual({ accessToken: "tok" });
  });

  it("사용자가 취소하면 error 로 끝난다", async () => {
    const { requestNativeKakaoLogin } = await import("./app-bridge");
    const w: Record<string, unknown> = { ReactNativeWebView: { postMessage: () => {} } };
    const p = requestNativeKakaoLogin(w);
    (w.__ukikiKakao as (r: unknown) => void)({ error: "cancel" });
    await expect(p).resolves.toEqual({ error: "cancel" });
  });
});
