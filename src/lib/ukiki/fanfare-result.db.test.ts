import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createFanfare, createRoom, endFanfare, enterRoom, listPastGames, saveFanfareResult } from "./rooms";

// 빵빠레 결과 저장 (실제 DB)
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-fr-host", "test-fr-a", "test-fr-b", "test-fr-c"];
const [H, A, B, C] = P;

describe.skipIf(!hasDb)("빵빠레 결과 (실제 DB)", () => {
  let room = "";
  let id = 0;

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(H, { name: "테스트 빵빠레 결과", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    for (const p of [A, B, C]) await enterRoom(room, p);
    const f = await createFanfare(room, H);
    if (f.kind !== "created") throw new Error("빵빠레 실패");
    id = f.id;
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${H}`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("호스트가 아니면 결과를 저장할 수 없다", async () => {
    expect(await saveFanfareResult(room, id, A, { [A]: 99 })).toBe(false);
  });

  it("방 멤버가 아닌 사람의 탭 기록은 무시한다", async () => {
    expect(await saveFanfareResult(room, id, H, { [A]: 12, [B]: 30, "test-fr-outsider": 50 })).toBe(true);
    const sql = getSql();
    const rows = (await sql`select kakao_id from uk_game_participants where game_id = ${id}`) as { kakao_id: string }[];
    expect(rows.map((r) => r.kakao_id)).not.toContain("test-fr-outsider");
  });

  it("다시 저장하면 최신 결과로 바뀐다 (참여자도 추가)", async () => {
    await saveFanfareResult(room, id, H, { [A]: 20, [B]: 30, [C]: 5 });
    await endFanfare(room, id, H);
    const past = await listPastGames(room, H);
    const g = past?.items.find((x) => x.id === id);
    expect(g?.fanfareResult?.map((r) => [r.kakaoId, r.taps, r.rank])).toEqual([
      [B, 30, 1],
      [A, 20, 2],
      [C, 5, 3],
    ]);
  });
});
