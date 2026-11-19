import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { drawCapsule, joinGame } from "@/lib/birthday-gacha/games";
import { createGachaInRoom, createRoom, enterRoom } from "./rooms";

// 방마다 진행 중인 생일 가챠는 1개 (실제 DB)
//   npm run test:db
const hasDb = !!process.env.DATABASE_URL;
const PEOPLE = ["test-ga-1", "test-ga-2", "test-ga-3", "test-ga-4", "test-ga-5"];
const OWNER = PEOPLE[0];

async function activeGachas(room: string) {
  const sql = getSql();
  return (await sql`
    select ref_code from uk_room_games
    where room_code = ${room} and game_type = 'gacha' and status = 'active'
  `) as { ref_code: string | null }[];
}

describe.skipIf(!hasDb)("생일 가챠 중복 개설 막기 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const [i, id] of PEOPLE.entries()) {
      await sql`insert into players (kakao_id, nickname) values (${id}, ${`가챠${i + 1}`}) on conflict do nothing`;
    }
    const r = await createRoom(OWNER, { name: "테스트 가챠 하나만", visibility: "public" });
    if (!r.ok) throw new Error("방 생성 실패");
    room = r.code;
    await Promise.all(PEOPLE.map((p) => enterRoom(room, p)));
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from games where host_kakao_id = any(${PEOPLE})`;
    await sql`delete from uk_rooms where owner_kakao_id = ${OWNER}`;
    await sql`delete from players where kakao_id = any(${PEOPLE})`;
  });

  it("방 멤버가 아니면 열 수 없다", async () => {
    const r = await createGachaInRoom(room, "test-ga-stranger");
    expect(r.kind).toBe("not_member");
  });

  it("5명이 동시에 열면 1개만 열리고, 나머지 4명은 그 가챠로 안내받는다", async () => {
    const results = await Promise.all(PEOPLE.map((p) => createGachaInRoom(room, p)));
    const created = results.filter((r) => r.kind === "created");
    const conflicts = results.filter((r) => r.kind === "conflict");
    expect(created).toHaveLength(1);
    expect(conflicts).toHaveLength(4);

    const gachaCode = (created[0] as { gachaCode: string }).gachaCode;
    for (const c of conflicts as { active: { gachaCode: string }; message: string }[]) {
      expect(c.active.gachaCode).toBe(gachaCode);
      expect(c.message).toMatch(/님이 먼저 생일 가챠를 열었어요$/);
    }
    expect(await activeGachas(room)).toEqual([{ ref_code: gachaCode }]);
  });

  it("캡슐을 다 뽑아 끝난 가챠는 자동으로 끝나고, 그다음엔 새 가챠를 열 수 있다", async () => {
    const sql = getSql();
    const [{ ref_code, host_kakao_id }] = (await sql`
      select ref_code, host_kakao_id from uk_room_games
      where room_code = ${room} and game_type = 'gacha' and status = 'active'
    `) as { ref_code: string; host_kakao_id: string }[];
    const code = ref_code;
    const players = [host_kakao_id, ...PEOPLE.filter((p) => p !== host_kakao_id).slice(0, 2)];
    const host = PEOPLE.find((p) => !players.includes(p))!;
    await Promise.all(players.map((p) => joinGame(code, p)));
    for (const p of players) for (let i = 0; i < 3; i++) await drawCapsule(code, p);

    expect(await activeGachas(room)).toEqual([]);
    const next = await createGachaInRoom(room, host);
    expect(next.kind).toBe("created");
    expect((next as { gachaCode: string }).gachaCode).not.toBe(code);
  });
});
