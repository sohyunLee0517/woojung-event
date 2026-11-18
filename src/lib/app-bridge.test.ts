import { describe, expect, it } from "vitest";
import { parseAppInfo } from "./app-bridge";

describe("parseAppInfo (우끼끼 앱 안에서 열렸는지)", () => {
  it("웹 브라우저면 null", () => {
    expect(parseAppInfo(undefined)).toBeNull();
    expect(parseAppInfo({})).toBeNull();
  });

  it("앱이 넣어 준 정보를 읽는다", () => {
    const w = { ReactNativeWebView: { injectedObjectJson: () => JSON.stringify({ app: "ukiki", platform: "android", pushToken: "ExponentPushToken[x]" }) } };
    expect(parseAppInfo(w)).toEqual({ platform: "android", pushToken: "ExponentPushToken[x]" });
  });

  it("알림을 허용 안 했으면 토큰 없이", () => {
    const w = { ReactNativeWebView: { injectedObjectJson: () => JSON.stringify({ app: "ukiki", platform: "android", pushToken: null }) } };
    expect(parseAppInfo(w)).toEqual({ platform: "android", pushToken: null });
  });

  it("다른 앱의 웹뷰거나 깨진 값이면 null", () => {
    expect(parseAppInfo({ ReactNativeWebView: { injectedObjectJson: () => "{oops" } })).toBeNull();
    expect(parseAppInfo({ ReactNativeWebView: { injectedObjectJson: () => JSON.stringify({ app: "other" }) } })).toBeNull();
  });
});
