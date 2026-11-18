import { describe, expect, it, vi } from "vitest";
import { expoEndpoint, expoTokenOf, isExpoEndpoint, sendExpoPush } from "./expo-push";

const TOKEN = "ExponentPushToken[abc123]";

describe("앱 푸시 토큰 저장 형식", () => {
  it("expo: 접두어로 웹 푸시와 구분한다", () => {
    expect(expoEndpoint(TOKEN)).toBe("expo:ExponentPushToken[abc123]");
    expect(isExpoEndpoint("expo:ExponentPushToken[abc123]")).toBe(true);
    expect(isExpoEndpoint("https://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(expoTokenOf("expo:ExponentPushToken[abc123]")).toBe(TOKEN);
  });

  it("Expo 토큰 모양이 아니면 받지 않는다", () => {
    expect(() => expoEndpoint("nope")).toThrow();
    expect(() => expoEndpoint("ExponentPushToken[]")).toThrow();
  });
});

describe("sendExpoPush", () => {
  const payload = { title: "🃏 퀴즈 열림", body: "맞히면 카드", url: "/birthday-gacha/g/ABC234", tag: "quiz" };

  it("Expo 푸시 서버에 알림을 보낸다 (링크는 data.url 로)", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ status: "ok", id: "t1" }] }) });
    const r = await sendExpoPush(TOKEN, payload, fetcher);
    expect(r).toBe("ok");
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(JSON.parse(init.body)).toEqual({
      to: TOKEN,
      title: payload.title,
      body: payload.body,
      data: { url: payload.url },
      sound: "default",
      channelId: "default",
      priority: "high",
      ttl: 7200,
    });
  });

  it("앱을 지운 기기(DeviceNotRegistered)는 gone 으로 알려서 지우게 한다", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: "error", message: "x", details: { error: "DeviceNotRegistered" } }] }),
    });
    expect(await sendExpoPush(TOKEN, payload, fetcher)).toBe("gone");
  });

  it("그 밖의 실패는 error", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ errors: [{ code: "X" }] }) });
    expect(await sendExpoPush(TOKEN, payload, fetcher)).toBe("error");
    const throwing = vi.fn().mockRejectedValue(new Error("network"));
    expect(await sendExpoPush(TOKEN, payload, throwing)).toBe("error");
  });
});
