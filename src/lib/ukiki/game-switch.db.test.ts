import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// 관리자가 게임을 끄면: 모든 방에서 새로 못 열고, 진행 중 목록에도 안 보인다 (실제 DB, 스위치만 가짜)
vi.mock("@/lib/ukiki/features", async (orig) => ({
  ...(await orig<typeof import("./features")>()),
  enabledGames: vi.fn(async () => ({ fanfare: true, gacha: false })),
}));

const { getSql } = await import("@/lib/db");
const { createGachaInRoom, createFanfare, createRoom, enterRoom, getRoomDetail } = await import("./rooms");

const hasDb = !!process.env.DATABASE_URL;
const P = ["test-gs-owner", "test-gs-a"];
const [O, A] = P;

describe.skipIf(!hasDb)("게임 끄기 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(O, { name: "테스트 게임 끄기", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    await enterRoom(room, A);
    // 꺼지기 전에 열려 있던 가챠 하나
    await sql`insert into uk_room_games (room_code, game_type, host_kakao_id, ref_code) values (${room}, 'gacha', ${O}, 'TESTGS')`;
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${O}`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("꺼진 게임은 새로 열 수 없다", async () => {
    expect(await createGachaInRoom(room, O)).toEqual({ kind: "disabled" });
    expect((await createFanfare(room, O)).kind).toBe("created");
  });

  it("방 화면에는 켜진 게임만 보이고, 어떤 게임이 켜져 있는지도 알려 준다", async () => {
    const d = await getRoomDetail(room, A);
    expect(d?.enabledGames).toEqual({ fanfare: true, gacha: false });
    expect(d?.games.map((g) => g.type)).toEqual(["fanfare"]);
  });
});
