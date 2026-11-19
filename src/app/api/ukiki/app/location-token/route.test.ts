import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyLocationToken } from "@/lib/app-location-token";

// 로그인한 사람만 자기 앱 위치 토큰을 받는다
let session: { user: { id: string } } | null = null;
vi.mock("@/auth", () => ({ auth: async () => session }));

describe("POST /api/ukiki/app/location-token", () => {
  beforeEach(() => {
    session = null;
    process.env.AUTH_SECRET = "s3cret";
  });

  it("로그인 안 했으면 401", async () => {
    const { POST } = await import("./route");
    expect((await POST()).status).toBe(401);
  });

  it("로그인했으면 내 카카오 ID로 풀리는 토큰을 준다", async () => {
    session = { user: { id: "987" } };
    const { POST } = await import("./route");
    const res = await POST();
    const { token } = (await res.json()) as { token: string };
    expect(verifyLocationToken(token, "s3cret")).toBe("987");
  });
});
