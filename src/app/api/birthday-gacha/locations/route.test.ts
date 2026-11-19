import { beforeEach, describe, expect, it, vi } from "vitest";
import { signLocationToken } from "@/lib/app-location-token";

// 위치 저장: 웹 로그인(쿠키) 또는 앱 위치 토큰(백그라운드)
const upsertLocation = vi.fn(async () => {});
vi.mock("@/lib/birthday-gacha/locations", () => ({ upsertLocation, deleteLocation: vi.fn() }));
vi.mock("@/lib/ukiki/map", () => ({ listRoomLocations: vi.fn() }));
let session: { user: { id: string } } | null = null;
vi.mock("@/auth", () => ({ auth: async () => session }));

const BODY = JSON.stringify({ lat: 37.5, lng: 127, accuracy: 20 });

describe("POST /api/birthday-gacha/locations", () => {
  beforeEach(() => {
    session = null;
    upsertLocation.mockClear();
    process.env.AUTH_SECRET = "s3cret";
  });

  it("앱 위치 토큰(Bearer)만 있어도 그 사람 위치로 저장한다", async () => {
    const { POST } = await import("./route");
    const token = signLocationToken("987", "s3cret", Date.now());
    const res = await POST(
      new Request("http://x", { method: "POST", body: BODY, headers: { authorization: `Bearer ${token}` } }),
    );
    expect(res.status).toBe(200);
    expect(upsertLocation).toHaveBeenCalledWith("987", { lat: 37.5, lng: 127, accuracy: 20 });
  });

  it("가짜 토큰이면 401", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x", { method: "POST", body: BODY, headers: { authorization: "Bearer nope.nope" } }),
    );
    expect(res.status).toBe(401);
    expect(upsertLocation).not.toHaveBeenCalled();
  });

  it("웹 로그인은 지금처럼 된다", async () => {
    session = { user: { id: "555" } };
    const { POST } = await import("./route");
    const res = await POST(new Request("http://x", { method: "POST", body: BODY }));
    expect(res.status).toBe(200);
    expect(upsertLocation).toHaveBeenCalledWith("555", expect.anything());
  });
});
