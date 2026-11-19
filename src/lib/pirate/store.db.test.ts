import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createRoom, enterRoom } from "@/lib/ukiki/rooms";
import { HOLES } from "./logic";
import { createPirate, getPirateState, joinPirate, setPirateReady, stab } from "./store";

// 해적 무찌르기 (실제 DB): 입장 순서대로 차례, 함정은 끝날 때까지 비밀
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-pr-a", "test-pr-b", "test-pr-c", "test-pr-out"];
const [A, B, C, OUT] = P;

async function startNow(id: number) {
  await getSql()`update uk_pirate_games set started_at = now() - interval '1 second' where game_id = ${id}`;
}

describe.skipIf(!hasDb)("해적 무찌르기 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(A, { name: "테스트 해적", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    for (const p of [B, C]) await enterRoom(room, p);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  async function open() {
    const g = await createPirate(room, A);
    if (g.kind !== "created") throw new Error("해적 실패 " + g.kind);
    return g.id;
  }

  it("방에 해적은 하나만 열린다 (두 번째는 conflict)", async () => {
    const id = await open();
    expect((await createPirate(room, B)).kind).toBe("conflict");
    await getSql()`update uk_room_games set status = 'ended' where id = ${id}`;
  });

  it("방 멤버만 들어오고, 모두 준비하면 3초 뒤 시작 · 입장 순서대로 차례", async () => {
    const id = await open();
    expect(await joinPirate(room, id, OUT)).toBe(false);
    await joinPirate(room, id, C); // 만든 A 다음, C 가 B 보다 먼저 들어옴
    await joinPirate(room, id, B);
    for (const p of [A, C]) await setPirateReady(room, id, p, true);
    expect((await getPirateState(room, id, A))?.startedAt).toBeNull();
    await setPirateReady(room, id, B, true);
    const s = await getPirateState(room, id, A);
    expect(s?.startedAt).not.toBeNull();
    expect(s?.order).toEqual([A, C, B]);
    expect(s?.turn).toBe(A);
    expect(s).not.toHaveProperty("trap");
    expect(await stab(room, id, A, 0)).toEqual({ ok: false, reason: "not_started" });
    await getSql()`update uk_room_games set status = 'ended' where id = ${id}`;
  });

  it("차례가 아니거나 이미 꽂힌 구멍이면 못 꽂는다", async () => {
    const id = await open();
    await joinPirate(room, id, B);
    for (const p of [A, B]) await setPirateReady(room, id, p, true);
    await startNow(id);
    const trap = ((await getSql()`select trap_hole from uk_pirate_games where game_id = ${id}`) as { trap_hole: number }[])[0].trap_hole;
    const safe = [...Array(HOLES).keys()].filter((h) => h !== trap);
    expect(await stab(room, id, B, safe[0])).toEqual({ ok: false, reason: "not_your_turn" });
    expect(await stab(room, id, A, safe[0])).toEqual({ ok: true, outcome: "continue" });
    expect(await stab(room, id, B, safe[0])).toEqual({ ok: false, reason: "taken" });
    expect(await stab(room, id, B, safe[1])).toEqual({ ok: true, outcome: "continue" });
    const s = await getPirateState(room, id, A);
    expect(s?.stabs.map((x) => x.hole)).toEqual([safe[0], safe[1]]);
    expect(s?.turn).toBe(A);
    await getSql()`update uk_room_games set status = 'ended' where id = ${id}`;
  });

  it("함정에 꽂으면 실패로 끝나고, 그때서야 함정 위치를 알려 준다", async () => {
    const id = await open();
    await joinPirate(room, id, B);
    for (const p of [A, B]) await setPirateReady(room, id, p, true);
    await startNow(id);
    const trap = ((await getSql()`select trap_hole from uk_pirate_games where game_id = ${id}`) as { trap_hole: number }[])[0].trap_hole;
    expect(await stab(room, id, A, trap)).toEqual({ ok: true, outcome: "fail" });
    const s = await getPirateState(room, id, B);
    expect(s?.status).toBe("fail");
    expect(s?.trap).toBe(trap);
    const g = (await getSql()`select status, outcome from uk_room_games where id = ${id}`) as { status: string; outcome: string }[];
    expect(g[0]).toEqual({ status: "ended", outcome: "completed" });
  });

  it("함정 하나만 남을 때까지 안 튀어나오면 모두 성공", async () => {
    const id = await open();
    await joinPirate(room, id, B);
    for (const p of [A, B]) await setPirateReady(room, id, p, true);
    await startNow(id);
    const trap = ((await getSql()`select trap_hole from uk_pirate_games where game_id = ${id}`) as { trap_hole: number }[])[0].trap_hole;
    const safe = [...Array(HOLES).keys()].filter((h) => h !== trap);
    let last = null;
    for (let i = 0; i < safe.length; i++) last = await stab(room, id, i % 2 === 0 ? A : B, safe[i]);
    expect(last).toEqual({ ok: true, outcome: "success" });
    expect((await getPirateState(room, id, A))?.status).toBe("success");
  });
});
