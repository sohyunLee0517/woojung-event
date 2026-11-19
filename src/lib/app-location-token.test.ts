import { describe, expect, it } from "vitest";
import { LOCATION_TOKEN_TTL_MS, signLocationToken, verifyLocationToken } from "./app-location-token";

// 앱이 꺼져 있을 때(백그라운드) 위치만 보낼 수 있는 앱 전용 토큰
const SECRET = "test-secret";
const NOW = Date.UTC(2026, 10, 19);

describe("앱 위치 토큰", () => {
  it("발급한 토큰은 카카오 계정 ID로 풀린다", () => {
    const t = signLocationToken("987", SECRET, NOW);
    expect(verifyLocationToken(t, SECRET, NOW + 1000)).toBe("987");
  });

  it("기한(90일)이 지나면 거절한다", () => {
    expect(LOCATION_TOKEN_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
    const t = signLocationToken("987", SECRET, NOW);
    expect(verifyLocationToken(t, SECRET, NOW + LOCATION_TOKEN_TTL_MS + 1)).toBeNull();
  });

  it("다른 비밀값으로 만들었거나 고친 토큰은 거절한다", () => {
    const t = signLocationToken("987", SECRET, NOW);
    expect(verifyLocationToken(t, "other", NOW)).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ k: "111", e: NOW + 1e9 })).toString("base64url");
    expect(verifyLocationToken(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
    expect(verifyLocationToken(`${body}.x${sig}`, SECRET, NOW)).toBeNull();
  });

  it("깨진 값·빈 값·비밀값 없음은 거절한다", () => {
    expect(verifyLocationToken("", SECRET, NOW)).toBeNull();
    expect(verifyLocationToken("abc", SECRET, NOW)).toBeNull();
    expect(verifyLocationToken(signLocationToken("987", SECRET, NOW), "", NOW)).toBeNull();
    expect(() => signLocationToken("987", "", NOW)).toThrow();
  });
});
