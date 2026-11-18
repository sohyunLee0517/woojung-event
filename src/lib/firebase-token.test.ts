import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createFirebaseCustomToken } from "./firebase-token";

// Firebase 커스텀 토큰 (서비스 계정 키로 서명한 JWT) — 공식 형식과 같은지 확인
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const sa = { client_email: "svc@demo.iam.gserviceaccount.com", private_key: pem };

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("createFirebaseCustomToken", () => {
  const now = 1_800_000_000;
  const token = createFirebaseCustomToken(sa, "5191279318", now);
  const [h, p, s] = token.split(".");

  it("RS256 JWT 이고 서비스 계정 키로 서명이 맞다", () => {
    expect(decode(h)).toEqual({ alg: "RS256", typ: "JWT" });
    const ok = verify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });

  it("Firebase 가 요구하는 내용: 발급자·대상·uid·1시간 만료", () => {
    expect(decode(p)).toEqual({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      uid: "5191279318",
      iat: now,
      exp: now + 3600,
    });
  });

  it("uid 가 비었거나 너무 길면 거절", () => {
    expect(() => createFirebaseCustomToken(sa, "", now)).toThrow();
    expect(() => createFirebaseCustomToken(sa, "x".repeat(129), now)).toThrow();
  });
});
