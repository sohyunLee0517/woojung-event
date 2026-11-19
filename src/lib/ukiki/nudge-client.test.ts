import { afterEach, describe, expect, it, vi } from "vitest";
import { requestNudge } from "./nudge-client";

const reply = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body)));

describe("requestNudge", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("보낸 사람 수 · 대상 없음 · 1분 제한을 문구로 알려 준다", async () => {
    vi.stubGlobal("fetch", reply({ ok: true, sent: 2 }));
    expect(await requestNudge("ABC", 3)).toBe("📣 2명에게 재촉했어요!");
    vi.stubGlobal("fetch", reply({ ok: true, sent: 0 }));
    expect(await requestNudge("ABC", 3)).toBe("알림을 받을 수 있는 친구가 없어요");
    vi.stubGlobal("fetch", reply({ ok: false, reason: "cooldown" }));
    expect(await requestNudge("ABC", "GACHA1")).toBe("방금 재촉했어요. 1분 뒤에 다시 눌러 주세요");
  });

  it("방·게임 번호로 재촉 API 를 부른다", async () => {
    const f = reply({ ok: true, sent: 1 });
    vi.stubGlobal("fetch", f);
    await requestNudge("ABC", 3);
    expect(f).toHaveBeenCalledWith("/api/ukiki/rooms/ABC/games/3/nudge", { method: "POST" });
  });
});
