import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// 새 게임 알림 · 재촉하기 (실제 DB). 푸시 전송만 가짜로 바꾼다.
const sent: { to: string; title: string; url: string }[] = [];
vi.mock("@/lib/birthday-gacha/push", () => ({
  sendPush: vi.fn(async (to: string, p: { title: string; url: string }) => {
    sent.push({ to, title: p.title, url: p.url });
    return 1;
  }),
}));

const { getSql } = await import("@/lib/db");
const { createFanfare, createGachaInRoom, createRoom, enterRoom, joinFanfare } = await import("./rooms");
const { joinGame } = await import("@/lib/birthday-gacha/games");
const { notifyNewGame, nudgeGame } = await import("./game-push");

const hasDb = !!process.env.DATABASE_URL;
const P = ["test-gp-opener", "test-gp-a", "test-gp-b", "test-gp-out"];
const [O, A, B, OUT] = P;

describe.skipIf(!hasDb)("게임 알림 (실제 DB)", () => {
  let room = "";
  let id = 0;

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(O, { name: "테스트 알림방", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    for (const p of [A, B]) await enterRoom(room, p);
    const f = await createFanfare(room, O);
    if (f.kind !== "created") throw new Error("빵빠레 실패");
    id = f.id;
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${O}`;
    await sql`delete from games where host_kakao_id = any(${P})`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  beforeEach(() => {
    sent.length = 0;
  });

  it("새 게임이 열리면 연 사람 빼고 방 멤버 모두에게 알린다", async () => {
    const n = await notifyNewGame(room, id, O);
    expect(n).toBe(2);
    expect(sent.map((s) => s.to).sort()).toEqual([A, B].sort());
    expect(sent[0].title).toContain("빵빠레");
    expect(sent[0].title).toContain("테스트 알림방");
    expect(sent[0].url).toBe(`/r/${room}/fanfare/${id}`);
  });

  it("재촉하기는 아직 안 들어온 멤버에게만 간다", async () => {
    await joinFanfare(room, id, A);
    const r = await nudgeGame(room, id, A);
    expect(r).toEqual({ ok: true, sent: 1 });
    expect(sent.map((s) => s.to)).toEqual([B]);
    expect(sent[0].title).toContain(A);
  });

  it("같은 게임은 1분에 한 번만 재촉할 수 있다", async () => {
    const r = await nudgeGame(room, id, O);
    expect(r).toEqual({ ok: false, reason: "cooldown" });
    expect(sent).toEqual([]);
  });

  it("방 멤버가 아니면 재촉할 수 없다", async () => {
    const sql = getSql();
    await sql`update uk_room_games set last_nudged_at = null where id = ${id}`;
    expect(await nudgeGame(room, id, OUT)).toEqual({ ok: false, reason: "not_member" });
  });

  it("가챠도 가챠 코드로 재촉한다: 자리에 앉은 사람은 빼고 보낸다", async () => {
    const g = await createGachaInRoom(room, O);
    if (g.kind !== "created") throw new Error("가챠 실패");
    await joinGame(g.gachaCode, A);
    sent.length = 0;
    const r = await nudgeGame(room, g.gachaCode, O);
    expect(r).toEqual({ ok: true, sent: 1 });
    expect(sent.map((s) => s.to)).toEqual([B]);
    expect(sent[0].url).toBe(`/birthday-gacha/g/${g.gachaCode}`);
  });
});
