import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createFanfare, createRoom, endFanfare, enterRoom, listPastGames } from "./rooms";

// 빵빠레 끝내는 방식: 완료 / 중단(기록 남음) / 닫기(시작 전, 기록 안 남음)
const hasDb = !!process.env.DATABASE_URL;
const [H, A] = ["test-fo-host", "test-fo-a"];

describe.skipIf(!hasDb)("빵빠레 끝내기 결과 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of [H, A]) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(H, { name: "테스트 빵빠레 끝내기", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    await enterRoom(room, A);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${H}`;
    await sql`delete from players where kakao_id in (${H}, ${A})`;
  });

  async function open() {
    const f = await createFanfare(room, H);
    if (f.kind !== "created") throw new Error("빵빠레 실패");
    return f.id;
  }

  it("중단하면 지난 게임에 '중단'으로 남는다", async () => {
    const id = await open();
    expect(await endFanfare(room, id, H, "aborted")).toBe(true);
    const g = (await listPastGames(room, A))?.items.find((x) => x.id === id);
    expect(g?.outcome).toBe("aborted");
  });

  it("공개까지 마치고 끝내면 '완료'", async () => {
    const id = await open();
    await endFanfare(room, id, H, "completed");
    const g = (await listPastGames(room, A))?.items.find((x) => x.id === id);
    expect(g?.outcome).toBe("completed");
  });

  it("시작 전에 닫으면 지난 게임에 안 남는다", async () => {
    const id = await open();
    await endFanfare(room, id, H, "cancelled");
    const g = (await listPastGames(room, A))?.items.find((x) => x.id === id);
    expect(g).toBeUndefined();
  });

  it("호스트가 아니면 끝낼 수 없다", async () => {
    const id = await open();
    expect(await endFanfare(room, id, A, "aborted")).toBe(false);
    await endFanfare(room, id, H, "cancelled");
  });
});
