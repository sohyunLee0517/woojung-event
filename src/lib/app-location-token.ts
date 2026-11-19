import { createHmac, timingSafeEqual } from "node:crypto";

// 앱이 꺼져 있을 때(백그라운드)도 위치만 보낼 수 있게 서버가 발급하는 앱 전용 토큰.
// 위치 저장 말고는 아무 데도 못 쓴다. 형식: base64url({k: 카카오ID, e: 만료ms}).서명
export const LOCATION_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function sign(body: string, secret: string) {
  return createHmac("sha256", `ukiki-location:${secret}`).update(body).digest("base64url");
}

export function signLocationToken(kakaoId: string, secret: string, nowMs = Date.now()) {
  if (!secret) throw new Error("AUTH_SECRET 이 없어요");
  const body = Buffer.from(JSON.stringify({ k: kakaoId, e: nowMs + LOCATION_TOKEN_TTL_MS })).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyLocationToken(token: string, secret: string, nowMs = Date.now()): string | null {
  if (!token || !secret) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const got = Buffer.from(sig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const v = JSON.parse(Buffer.from(body, "base64url").toString()) as { k?: unknown; e?: unknown };
    if (typeof v.k !== "string" || typeof v.e !== "number" || v.e < nowMs) return null;
    return v.k;
  } catch {
    return null;
  }
}
