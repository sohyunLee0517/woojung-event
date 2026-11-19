import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createRoom, enterRoom, listPastGames } from "@/lib/ukiki/rooms";
import { simulateOrder } from "./logic";
import { createPinball, getPinballState, joinPinball, setPinballReady } from "./store";

// 랜덤 핀볼 (실제 DB): 모두 준비하면 시드가 정해지고, 순서는 그 시드로 서버가 계산해 둔다
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-pb-a", "test-pb-b", "test-pb-c"];
const [A, B, OUT] = P;

describe.skipIf(!hasDb)("랜덤 핀볼 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(A, { name: "테스트 핀볼", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    await enterRoom(room, B);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("방마다 하나, 방 밖 사람은 못 들어온다", async () => {
    const g = await createPinball(room, A);
    expect(g.kind).toBe("created");
    if (g.kind !== "created") return;
    expect((await createPinball(room, B)).kind).toBe("conflict");
    expect(await joinPinball(room, g.id, OUT)).toBe(false);
    expect(await joinPinball(room, g.id, B)).toBe(true);

    const before = await getPinballState(room, g.id, A);
    expect(before?.startedAt).toBeNull();
    expect(before?.seed).toBeNull();

    await setPinballReady(room, g.id, A, true);
    expect((await getPinballState(room, g.id, A))?.startedAt).toBeNull();
    await setPinballReady(room, g.id, B, true);

    const s = (await getPinballState(room, g.id, B))!;
    expect(s.startedAt).not.toBeNull();
    expect(s.members).toEqual([A, B]);
    expect(s.order).toEqual(simulateOrder(s.members, s.seed!));

    // 시작하면 다음 판을 새로 열 수 있고, 지난 게임에 1등이 나온다
    expect((await createPinball(room, A)).kind).toBe("created");
    const past = await listPastGames(room, A);
    const item = past!.items.find((x) => x.id === g.id);
    expect(item?.miniResult?.summary).toContain(s.order[0]);
    expect(item?.miniResult?.rows.map((r) => r.kakaoId)).toEqual(s.order);
  });
});
