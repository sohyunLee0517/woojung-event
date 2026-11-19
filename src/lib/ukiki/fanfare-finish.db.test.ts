import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { cancelFanfare, createFanfare, createRoom, enterRoom, finishFanfare, joinFanfare, listPastGames } from "./rooms";

// 호스트 없는 빵빠레: 100도 → 순위가 나오면 참여자 누구나 결과를 저장하고 게임을 끝낸다 (실제 DB)
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-ff-maker", "test-ff-a", "test-ff-b", "test-ff-out"];
const [M, A, B, OUT] = P;

describe.skipIf(!hasDb)("빵빠레 끝내기 (호스트 없음, 실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(M, { name: "테스트 빵빠레 끝내기", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    for (const p of [A, B]) await enterRoom(room, p);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${M}`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  async function open() {
    const f = await createFanfare(room, M);
    if (f.kind !== "created") throw new Error("빵빠레 실패");
    return f.id;
  }

  it("만든 사람이 아니어도 참여자면 결과를 저장하고 끝낼 수 있다 (두 번 불러도 괜찮다)", async () => {
    const id = await open();
    await joinFanfare(room, id, A);
    await joinFanfare(room, id, B);
    expect(await finishFanfare(room, id, A, { [A]: 7, [B]: 12, [OUT]: 99 })).toBe(true);
    expect(await finishFanfare(room, id, B, { [A]: 7, [B]: 12 })).toBe(true);
    const g = (await listPastGames(room, A))?.items.find((x) => x.id === id);
    expect(g?.outcome ?? "completed").toBe("completed");
    expect(g?.fanfareResult?.map((r) => [r.kakaoId, r.taps, r.rank])).toEqual([
      [B, 12, 1],
      [A, 7, 2],
    ]);
  });

  it("방 멤버가 아니면 끝낼 수 없다", async () => {
    const id = await open();
    expect(await finishFanfare(room, id, OUT, { [OUT]: 1 })).toBe(false);
    expect(await cancelFanfare(room, id, OUT)).toBe(false);
    expect(await cancelFanfare(room, id, A)).toBe(true);
  });

  it("시작 전 빵빠레는 방 멤버 누구나 닫을 수 있고 기록이 남지 않는다", async () => {
    const id = await open();
    expect(await cancelFanfare(room, id, B)).toBe(true);
    const past = await listPastGames(room, B);
    expect(past?.items.find((x) => x.id === id)).toBeUndefined();
  });
});
