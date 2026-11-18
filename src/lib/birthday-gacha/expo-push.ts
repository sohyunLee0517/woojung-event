// 우끼끼 안드로이드 앱 푸시 (Expo 푸시 서비스). 웹 푸시와 같은 테이블에 'expo:토큰' 으로 저장한다.
import type { PushPayload } from "@/lib/birthday-gacha/push";

const TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const PREFIX = "expo:";

export function expoEndpoint(token: string) {
  if (!TOKEN_RE.test(token)) throw new Error("Expo 푸시 토큰 모양이 아니에요");
  return PREFIX + token;
}

export function isExpoEndpoint(endpoint: string) {
  return endpoint.startsWith(PREFIX);
}

export function expoTokenOf(endpoint: string) {
  return endpoint.slice(PREFIX.length);
}

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

/** ok: 보냄 · gone: 앱이 지워진 기기(토큰 삭제) · error: 그 밖의 실패 */
export async function sendExpoPush(token: string, payload: PushPayload, fetcher: Fetcher = fetch as unknown as Fetcher) {
  try {
    const res = await fetcher("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        data: { url: payload.url },
        sound: "default",
        channelId: "default",
        priority: "high",
        ttl: 7200,
      }),
    });
    if (!res.ok) return "error" as const;
    const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] | { status: string; details?: { error?: string } } };
    const ticket = Array.isArray(json.data) ? json.data[0] : json.data;
    if (ticket?.status === "ok") return "ok" as const;
    if (ticket?.details?.error === "DeviceNotRegistered") return "gone" as const;
    return "error" as const;
  } catch {
    return "error" as const;
  }
}
