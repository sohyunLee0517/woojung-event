import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createRoom, enterRoom, listPastGames } from "./rooms";
import { createPinball, getPinballState, joinPinball, setPinballReady, tickPinball } from "@/lib/pinball/store";
import { myBananas } from "@/lib/bananas/store";
import { waitOver } from "./test-helpers";

// 대기실 규칙 (실제 DB, 핀볼로 확인): 전원 준비완료면 바로, 아니면 제한 시간에 준비한 사람끼리, 2명이 안 되면 노게임
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-wt-a", "test-wt-b", "test-wt-c"];
const [A, B, C] = P;

describe.skipIf(!hasDb)("대기실 규칙 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    await sql`delete from uk_banana_ledger where kakao_id = any(${P})`;
    await sql`delete from uk_banana_wallets where kakao_id = any(${P})`;
    const r = await createRoom(A, { name: "테스트 대기실", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    await enterRoom(room, B);
    await enterRoom(room, C);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from uk_banana_ledger where kakao_id = any(${P})`;
    await sql`delete from uk_banana_wallets where kakao_id = any(${P})`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("일부만 준비완료면 기다리고, 제한 시간이 되면 준비한 사람끼리 시작한다 (준비 안 한 사람은 빠진다)", async () => {
    const g = await createPinball(room, A);
    if (g.kind !== "created") throw new Error();
    await joinPinball(room, g.id, B);
    await joinPinball(room, g.id, C);
    await setPinballReady(room, g.id, A, true);
    await setPinballReady(room, g.id, B, true);

    const waiting = await getPinballState(room, g.id, A);
    expect(waiting?.startedAt).toBeNull();
    expect(waiting?.roomSize).toBe(3);
    expect(waiting?.waitUntil).not.toBeNull();
    expect(waiting?.cancelled).toBe(false);

    await waitOver(g.id);
    await tickPinball(room, g.id);
    const s = await getPinballState(room, g.id, C);
    expect(s?.startedAt).not.toBeNull();
    expect(s?.members).toEqual([A, B]);
  });

  it("제한 시간에 준비완료한 사람이 혼자뿐이면 노게임: 닫히고, 지난 게임·바나나에 안 남고, 새로 열 수 있다", async () => {
    const g = await createPinball(room, A);
    if (g.kind !== "created") throw new Error();
    await joinPinball(room, g.id, B); // 들어오기만 하고 준비는 안 누름
    await setPinballReady(room, g.id, A, true);
    await waitOver(g.id);
    await tickPinball(room, g.id);

    const s = await getPinballState(room, g.id, A);
    expect(s?.cancelled).toBe(true);
    expect(s?.startedAt).toBeNull();
    expect((await listPastGames(room, A))?.items.some((x) => x.id === g.id)).toBe(false);
    const bananas = await myBananas(C);
    expect(bananas).toBe(0);
    expect((await createPinball(room, B)).kind).toBe("created");
  });

  it("방 인원 전원이 준비완료하면 기다리지 않고 바로 시작한다", async () => {
    const sql = getSql();
    const open = (await sql`select id from uk_room_games where room_code = ${room} and game_type = 'pinball' and status = 'active'`) as { id: number }[];
    const id = Number(open[0].id);
    for (const p of P) await joinPinball(room, id, p);
    await setPinballReady(room, id, A, true);
    await setPinballReady(room, id, B, true);
    expect((await getPinballState(room, id, A))?.startedAt).toBeNull();
    await setPinballReady(room, id, C, true);
    const s = await getPinballState(room, id, A);
    expect(s?.startedAt).not.toBeNull();
    expect(s?.members).toEqual([B, A, C]);
  });
});
