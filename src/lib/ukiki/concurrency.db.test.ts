import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createGame, drawCapsule, joinGame } from "@/lib/birthday-gacha/games";
import { createFanfare, createRoom, endFanfare, enterRoom } from "./rooms";

// 동시성 테스트 (실제 DB). 여러 요청을 한꺼번에 보내도 규칙이 깨지지 않는지 본다.
//   npm run test:db
const hasDb = !!process.env.DATABASE_URL;
const PEOPLE = ["test-cc-1", "test-cc-2", "test-cc-3", "test-cc-4", "test-cc-5"];
const OWNER = PEOPLE[0];

describe.skipIf(!hasDb)("동시성 (실제 DB)", () => {
  let room = "";
  let secret = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const [i, id] of PEOPLE.entries()) {
      await sql`insert into players (kakao_id, nickname) values (${id}, ${`동시${i + 1}`}) on conflict do nothing`;
    }
    const r = await createRoom(OWNER, { name: "테스트 동시성방", visibility: "public" });
    const s = await createRoom(OWNER, { name: "테스트 동시성 비밀방", visibility: "private", password: "1234" });
    if (!r.ok || !s.ok) throw new Error("방 생성 실패");
    room = r.code;
    secret = s.code;
    await Promise.all(PEOPLE.map((p) => enterRoom(room, p)));
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from games where host_kakao_id = any(${PEOPLE})`;
    await sql`delete from uk_rooms where owner_kakao_id = ${OWNER}`;
    await sql`delete from players where kakao_id = any(${PEOPLE})`;
  });

  it("5명이 동시에 빵빠레를 만들면 정확히 1개만 열리고, 나머지 4명은 모두 그 빵빠레를 안내받는다", async () => {
    const results = await Promise.all(PEOPLE.map((p) => createFanfare(room, p)));
    const created = results.filter((r) => r.kind === "created") as { kind: "created"; id: number }[];
    const conflicts = results.filter((r) => r.kind === "conflict") as Extract<
      (typeof results)[number],
      { kind: "conflict" }
    >[];
    expect(created).toHaveLength(1);
    expect(conflicts).toHaveLength(4);
    expect(new Set(conflicts.map((c) => c.active.id))).toEqual(new Set([created[0].id]));

    const sql = getSql();
    const active = (await sql`
      select count(*)::int as n from uk_room_games
      where room_code = ${room} and game_type = 'fanfare' and status = 'active'
    `) as { n: number }[];
    expect(active[0].n).toBe(1);
  });

  it("호스트가 끝내는 순간 다른 사람들이 동시에 새로 열어도 진행 중인 빵빠레는 1개를 넘지 않는다", async () => {
    const sql = getSql();
    const cur = (await sql`
      select id, host_kakao_id from uk_room_games
      where room_code = ${room} and game_type = 'fanfare' and status = 'active'
    `) as { id: number; host_kakao_id: string }[];
    const others = PEOPLE.filter((p) => p !== cur[0].host_kakao_id);

    await Promise.all([
      endFanfare(room, Number(cur[0].id), cur[0].host_kakao_id),
      ...others.map((p) => createFanfare(room, p)),
      ...others.map((p) => createFanfare(room, p)),
    ]);

    const active = (await sql`
      select count(*)::int as n from uk_room_games
      where room_code = ${room} and game_type = 'fanfare' and status = 'active'
    `) as { n: number }[];
    expect(active[0].n).toBeLessThanOrEqual(1);
  });

  it("같은 사람이 같은 방에 동시에 여러 번 들어와도 멤버는 한 줄만 생긴다", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => enterRoom(room, PEOPLE[1])));
    expect(results.every((r) => r === "enter")).toBe(true);
    const sql = getSql();
    const rows = (await sql`
      select count(*)::int as n from uk_room_members where room_code = ${room} and kakao_id = ${PEOPLE[1]}
    `) as { n: number }[];
    expect(rows[0].n).toBe(1);
  });

  it("비밀방에 맞는/틀린 비밀번호가 동시에 들어와도 맞힌 사람만 멤버가 된다", async () => {
    const [right, wrong] = [PEOPLE[1], PEOPLE[2]];
    const results = await Promise.all([
      enterRoom(secret, right, "1234"),
      enterRoom(secret, wrong, "0000"),
      enterRoom(secret, right, "1234"),
      enterRoom(secret, wrong, "9999"),
    ]);
    expect(results).toEqual(["enter", "wrong_password", "enter", "wrong_password"]);
    const sql = getSql();
    const members = (await sql`
      select kakao_id from uk_room_members where room_code = ${secret} order by kakao_id
    `) as { kakao_id: string }[];
    expect(members.map((m) => m.kakao_id)).toEqual([OWNER, right].sort());
  });

  it("방을 동시에 여러 개 만들어도 방 코드가 겹치지 않는다", async () => {
    const made = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createRoom(OWNER, { name: `테스트 동시 생성 ${i}`, visibility: "public" })),
    );
    expect(made.every((m) => m.ok)).toBe(true);
    const codes = made.map((m) => (m as { ok: true; code: string }).code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("가챠: 3명이 동시에 뽑기를 연타해도 캡슐이 두 번 뽑히지 않고, 뽑기권·금액이 정확하다", async () => {
    const players = PEOPLE.slice(0, 3);
    const code = await createGame(players[0]);
    await Promise.all(players.slice(1).map((p) => joinGame(code, p)));

    // 각자 뽑기권 3장인데 5번씩 동시에 누른다
    const results = await Promise.all(players.flatMap((p) => Array.from({ length: 5 }, () => drawCapsule(code, p))));
    const ok = results.filter((r) => r.ok);
    expect(ok).toHaveLength(9);

    const sql = getSql();
    const capsules = (await sql`
      select drawn_by, amount, minutes from capsules where game_code = ${code}
    `) as { drawn_by: string | null; amount: number; minutes: number }[];
    expect(capsules.every((c) => c.drawn_by)).toBe(true);

    const gp = (await sql`
      select kakao_id, tickets, money, minutes from game_players where game_code = ${code}
    `) as { kakao_id: string; tickets: number; money: number; minutes: number }[];
    for (const p of gp) {
      const mine = capsules.filter((c) => c.drawn_by === p.kakao_id);
      expect(mine).toHaveLength(3);
      expect(p.tickets).toBe(0);
      expect(p.money).toBe(mine.reduce((s, c) => s + c.amount, 0));
      expect(p.minutes).toBe(mine.reduce((s, c) => s + c.minutes, 0));
    }
  });

  it("가챠: 4명이 동시에 3인 방에 참가하면 3명만 앉고 자리 번호가 겹치지 않는다", async () => {
    const code = await createGame(PEOPLE[0]);
    const results = await Promise.all(PEOPLE.slice(1).map((p) => joinGame(code, p)));
    expect(results.filter((r) => r === "joined")).toHaveLength(2);
    expect(results.filter((r) => r === "full")).toHaveLength(2);

    const sql = getSql();
    const seats = (await sql`select seat from game_players where game_code = ${code} order by seat`) as {
      seat: number;
    }[];
    expect(seats.map((s) => s.seat)).toEqual([1, 2, 3]);
  });
});
