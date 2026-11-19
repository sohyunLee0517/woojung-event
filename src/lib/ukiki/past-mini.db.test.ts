import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createRoom, enterRoom, listPastGames } from "./rooms";
import { createPirate, joinPirate, setPirateReady, stab } from "@/lib/pirate/store";
import { createSnack, cutSnack, joinSnack, setSnackReady } from "@/lib/snack/store";

// 지난 게임에 해적·과자 결과도 나온다 (실제 DB)
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-pm-a", "test-pm-b"];
const [A, B] = P;

describe.skipIf(!hasDb)("지난 게임: 해적·과자 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(A, { name: "테스트 지난 미니게임", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    await enterRoom(room, B);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("해적: 실패/성공과 참여자별 꽂은 칼 수", async () => {
    const g = await createPirate(room, A);
    if (g.kind !== "created") throw new Error();
    await joinPirate(room, g.id, B);
    for (const p of P) await setPirateReady(room, g.id, p, true);
    const sql = getSql();
    await sql`update uk_pirate_games set started_at = now() - interval '1 second' where game_id = ${g.id}`;
    const trap = ((await sql`select trap_hole from uk_pirate_games where game_id = ${g.id}`) as { trap_hole: number }[])[0].trap_hole;
    const safe = (trap + 1) % 16;
    await stab(room, g.id, A, safe);
    await stab(room, g.id, B, trap);
    const item = (await listPastGames(room, A))?.items.find((x) => x.id === g.id);
    expect(item?.miniResult).toEqual({
      summary: "🏴‍☠️ 실패",
      rows: [
        { kakaoId: A, nickname: A, value: "칼 1개" },
        { kakaoId: B, nickname: B, value: "칼 1개" },
      ],
    });
  });

  it("과자: 팀 점수와 각자 자른 양", async () => {
    const g = await createSnack(room, A);
    if (g.kind !== "created") throw new Error();
    await joinSnack(room, g.id, B);
    for (const p of P) await setSnackReady(room, g.id, p, true);
    await getSql()`update uk_snack_games set started_at = now() - interval '1 second' where game_id = ${g.id}`;
    await cutSnack(room, g.id, A, 40);
    await cutSnack(room, g.id, B, 35);
    const item = (await listPastGames(room, A))?.items.find((x) => x.id === g.id);
    expect(item?.miniResult).toEqual({
      summary: "🎯 팀 점수 75점",
      rows: [
        { kakaoId: A, nickname: A, value: "40%" },
        { kakaoId: B, nickname: B, value: "35%" },
      ],
    });
  });
});
