import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startGachaNow } from "@/lib/ukiki/test-helpers";
import { getSql } from "@/lib/db";
import { createGame, drawCapsule, joinGame } from "@/lib/birthday-gacha/games";

// 가챠도 2명 이상 모여야 뽑을 수 있다 (실제 DB)
const hasDb = !!process.env.DATABASE_URL;
const [A, B] = ["test-min-a", "test-min-b"];

describe.skipIf(!hasDb)("가챠 최소 인원 (실제 DB)", () => {
  let code = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of [A, B]) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    code = await createGame(A);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from games where host_kakao_id = ${A}`;
    await sql`delete from players where kakao_id in (${A}, ${B})`;
  });

  it("혼자서는 뽑을 수 없다 (뽑기권은 그대로)", async () => {
    expect(await drawCapsule(code, A)).toEqual({ ok: false, reason: "need_players" });
    const sql = getSql();
    const t = (await sql`select tickets from game_players where game_code = ${code} and kakao_id = ${A}`) as { tickets: number }[];
    expect(t[0].tickets).toBe(3);
  });

  it("친구가 들어오면 뽑을 수 있다", async () => {
    await joinGame(code, B);
    await startGachaNow(code);
    expect((await drawCapsule(code, A)).ok).toBe(true);
  });
});
