// 우끼끼 안드로이드 앱 푸시: Firebase Cloud Messaging 으로 바로 보낸다 (Expo 같은 중간 서비스 없음).
// 웹 푸시와 같은 테이블에 'fcm:기기토큰' 으로 저장한다.
import type { PushPayload } from "@/lib/birthday-gacha/push";

const PREFIX = "fcm:";
const TOKEN_RE = /^[\w:-]{20,4096}$/;

export function fcmEndpoint(token: string) {
  if (!TOKEN_RE.test(token)) throw new Error("FCM 기기 토큰 모양이 아니에요");
  return PREFIX + token;
}

export function isFcmEndpoint(endpoint: string) {
  return endpoint.startsWith(PREFIX);
}

export function fcmTokenOf(endpoint: string) {
  return endpoint.slice(PREFIX.length);
}

export type FcmMessage = {
  token: string;
  notification: { title: string; body: string };
  data: Record<string, string>;
  android: { priority: "high"; ttl: number; notification: { channelId: string; tag?: string; sound: string } };
};
type Sender = (m: FcmMessage) => Promise<string>;

const GONE = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);

/** ok: 보냄 · gone: 앱이 지워진 기기(토큰 삭제) · error: 그 밖의 실패 */
export async function sendFcmPush(token: string, payload: PushPayload, send?: Sender) {
  const sender = send ?? (await defaultSender());
  if (!sender) return "error" as const;
  try {
    await sender({
      token,
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url },
      android: {
        priority: "high",
        ttl: 7_200_000,
        notification: { channelId: "default", tag: payload.tag, sound: "default" },
      },
    });
    return "ok" as const;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (GONE.has(code)) return "gone" as const;
    console.error("[fcm] 보내기 실패", code, e);
    return "error" as const;
  }
}

async function defaultSender(): Promise<Sender | null> {
  const { fcmSender } = await import("@/lib/firebase-admin");
  return fcmSender();
}
