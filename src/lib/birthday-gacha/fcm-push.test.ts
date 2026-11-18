import { describe, expect, it, vi } from "vitest";
import { fcmEndpoint, fcmTokenOf, isFcmEndpoint, sendFcmPush } from "./fcm-push";

const TOKEN = "dQw4w9WgXcQ:APA91bH-abc_DEF123456789";

describe("앱 푸시(FCM) 토큰 저장 형식", () => {
  it("fcm: 접두어로 웹 푸시와 구분한다", () => {
    expect(fcmEndpoint(TOKEN)).toBe(`fcm:${TOKEN}`);
    expect(isFcmEndpoint(`fcm:${TOKEN}`)).toBe(true);
    expect(isFcmEndpoint("https://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(fcmTokenOf(`fcm:${TOKEN}`)).toBe(TOKEN);
  });

  it("토큰 모양이 이상하면 받지 않는다", () => {
    expect(() => fcmEndpoint("")).toThrow();
    expect(() => fcmEndpoint("short")).toThrow();
    expect(() => fcmEndpoint("has space in it but long enough")).toThrow();
  });
});

describe("sendFcmPush (Firebase 로 바로 보내기)", () => {
  const payload = { title: "🃏 퀴즈 열림", body: "맞히면 카드", url: "/birthday-gacha/g/ABC234", tag: "quiz" };

  it("알림 + 눌렀을 때 열 주소(data.url)를 보낸다", async () => {
    const send = vi.fn().mockResolvedValue("projects/x/messages/1");
    expect(await sendFcmPush(TOKEN, payload, send)).toBe("ok");
    expect(send).toHaveBeenCalledWith({
      token: TOKEN,
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url },
      android: {
        priority: "high",
        ttl: 7_200_000,
        notification: { channelId: "default", tag: "quiz", sound: "default" },
      },
    });
  });

  it("앱을 지운 기기면 gone (토큰 삭제)", async () => {
    for (const code of ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]) {
      const send = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code }));
      expect(await sendFcmPush(TOKEN, payload, send)).toBe("gone");
    }
  });

  it("그 밖의 실패는 error", async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code: "messaging/internal-error" }));
    expect(await sendFcmPush(TOKEN, payload, send)).toBe("error");
  });
});
