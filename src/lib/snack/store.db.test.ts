import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createRoom, enterRoom } from "@/lib/ukiki/rooms";
import { createSnack, cutSnack, getSnackState, joinSnack, setSnackReady, tickSnack } from "./store";
import { waitOver } from "@/lib/ukiki/test-helpers";

// 과자 나눠먹기 (실제 DB): 한 번만 자르고, 모두 자를 때까지 남의 몫은 비밀
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-sn-a", "test-sn-b", "test-sn-c"];
const [A, B, C] = P;

async function startNow(id: number) {
  await getSql()`update uk_snack_games set started_at = now() - interval '1 second' where game_id = ${id}`;
}

describe.skipIf(!hasDb)("과자 나눠먹기 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(A, { name: "테스트 과자", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    for (const p of [B, C]) await enterRoom(room, p);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  async function openWith(players: string[]) {
    const g = await createSnack(room, A);
    if (g.kind !== "created") throw new Error("과자 실패 " + g.kind);
    for (const p of players) await joinSnack(room, g.id, p);
    for (const p of [A, ...players]) await setSnackReady(room, g.id, p, true);
    await waitOver(g.id); // 방 인원 일부만 준비했으면 제한 시간이 지나야 시작
    await tickSnack(room, g.id);
    return g.id;
  }

  it("방에 과자는 하나만, 시작 전엔 못 자른다", async () => {
    const g = await createSnack(room, A);
    if (g.kind !== "created") throw new Error();
    expect((await createSnack(room, B)).kind).toBe("conflict");
    await joinSnack(room, g.id, B);
    await setSnackReady(room, g.id, A, true);
    expect(await cutSnack(room, g.id, A, 30)).toEqual({ ok: false, reason: "not_started" });
    await getSql()`update uk_room_games set status = 'ended' where id = ${g.id}`;
  });

  it("한 번만 자를 수 있고, 다 자르기 전엔 남의 몫이 안 보인다", async () => {
    const id = await openWith([B, C]);
    await startNow(id);
    expect(await cutSnack(room, id, A, 30)).toEqual({ ok: true });
    expect(await cutSnack(room, id, A, 10)).toEqual({ ok: false, reason: "already_cut" });
    const s = await getSnackState(room, id, B);
    expect(s?.players.map((p) => [p.id, p.done, p.cut])).toEqual([
      [A, true, null],
      [B, false, null],
      [C, false, null],
    ]);
    expect(s?.result).toBeNull();
    expect(s?.myCut).toBeNull();
    expect((await getSnackState(room, id, A))?.myCut).toBe(30);
    await getSql()`update uk_room_games set status = 'ended' where id = ${id}`;
  });

  it("모두 자르면 공개: 100 이하면 성공(팀 점수 = 합계)", async () => {
    const id = await openWith([B, C]);
    await startNow(id);
    await cutSnack(room, id, A, 30);
    await cutSnack(room, id, B, 40);
    await cutSnack(room, id, C, 25);
    const s = await getSnackState(room, id, A);
    expect(s?.result).toEqual({ status: "success", total: 95 });
    expect(s?.players.map((p) => p.cut)).toEqual([30, 40, 25]);
    const g = (await getSql()`select status from uk_room_games where id = ${id}`) as { status: string }[];
    expect(g[0].status).toBe("ended");
  });

  it("합이 100을 넘으면 실패", async () => {
    const id = await openWith([B]);
    await startNow(id);
    await cutSnack(room, id, A, 60);
    await cutSnack(room, id, B, 41);
    expect((await getSnackState(room, id, B))?.result).toEqual({ status: "fail", total: 101 });
  });

  it("시작한 뒤 들어온 사람은 구경만 한다", async () => {
    const id = await openWith([B]);
    await startNow(id);
    await joinSnack(room, id, C);
    expect(await cutSnack(room, id, C, 10)).toEqual({ ok: false, reason: "not_player" });
    await getSql()`update uk_room_games set status = 'ended' where id = ${id}`;
  });
});
