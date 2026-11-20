import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createRoom, enterRoom } from "@/lib/ukiki/rooms";
import { createPinball, joinPinball, setPinballReady } from "@/lib/pinball/store";
import { createSnack, cutSnack, joinSnack, setSnackReady } from "@/lib/snack/store";
import { applyRetroBananas, bananaBalance, grantBananas, myBananas, refundBananas, retroBananaPlan, settleBananas, spendBananas } from "./store";

// 바나나 장부 (실제 DB)
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-bn-a", "test-bn-b", "test-bn-c"];
const [A, B, C] = P;

async function cleanLedger() {
  const sql = getSql();
  await sql`delete from uk_banana_ledger where kakao_id = any(${P})`;
  await sql`delete from uk_banana_wallets where kakao_id = any(${P})`;
}

describe.skipIf(!hasDb)("바나나 장부 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    await cleanLedger();
    const r = await createRoom(A, { name: "테스트 바나나", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    await enterRoom(room, B);
  });

  afterAll(async () => {
    const sql = getSql();
    await cleanLedger();
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("처음엔 바나나 0개", async () => {
    expect(await bananaBalance(C)).toBe(0);
  });

  it("핀볼이 끝나면 1등은 3개(참여 1 + 1등 2), 나머지는 1개. 다시 정산해도 두 번 주지 않는다", async () => {
    const g = await createPinball(room, A);
    if (g.kind !== "created") throw new Error();
    await joinPinball(room, g.id, B);
    await setPinballReady(room, g.id, A, true);
    await setPinballReady(room, g.id, B, true);
    const order = ((await getSql()`select result_order from uk_pinball_games where game_id = ${g.id}`) as { result_order: string[] }[])[0].result_order;
    const [first, second] = order;

    expect(await myBananas(first)).toBe(3);
    expect(await myBananas(second)).toBe(1);
    expect(await settleBananas(first)).toBe(0);
    expect(await bananaBalance(first)).toBe(3);
  });

  it("과자 나눠먹기 팀 성공이면 모두 3개씩 더", async () => {
    const before = { a: await myBananas(A), b: await myBananas(B) };
    const g = await createSnack(room, A);
    if (g.kind !== "created") throw new Error();
    await joinSnack(room, g.id, B);
    await setSnackReady(room, g.id, A, true);
    await setSnackReady(room, g.id, B, true);
    await getSql()`update uk_snack_games set started_at = now() - interval '1 second' where game_id = ${g.id}`;
    await cutSnack(room, g.id, A, 30);
    await cutSnack(room, g.id, B, 30);
    expect(await myBananas(A)).toBe(before.a + 3);
    expect(await myBananas(B)).toBe(before.b + 3);
  });

  it("10개가 안 되면 쓸 수 없고, 되면 빠진다. 환불은 한 번만", async () => {
    expect(await spendBananas(C, 10)).toEqual({ ok: false, balance: 0 });
    await grantBananas(C, 12, "test");
    const spent = await spendBananas(C, 10);
    if (!spent.ok) throw new Error("써져야 함");
    expect(await bananaBalance(C)).toBe(2);
    await refundBananas(C, spent.ledgerId);
    await refundBananas(C, spent.ledgerId);
    expect(await bananaBalance(C)).toBe(12);
  });

  it("동시에 두 번 써도 잔액보다 많이 빠지지 않는다", async () => {
    const balance = await bananaBalance(C); // 12
    const results = await Promise.all([spendBananas(C, 10), spendBananas(C, 10)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await bananaBalance(C)).toBe(balance - 10);
  });

  it("소급 정산: 기능 전에 끝난 게임은 평소 정산에선 안 주고, 계획을 본 뒤 한 번만 '소급 정산'으로 준다", async () => {
    const g = await createPinball(room, A);
    if (g.kind !== "created") throw new Error();
    await joinPinball(room, g.id, B);
    await setPinballReady(room, g.id, A, true);
    await setPinballReady(room, g.id, B, true);
    await getSql()`update uk_room_games set ended_at = '2026-11-10T12:00:00+09:00' where id = ${g.id}`;
    const order = ((await getSql()`select result_order from uk_pinball_games where game_id = ${g.id}`) as { result_order: string[] }[])[0].result_order;
    const before = { [A]: await myBananas(A), [B]: await myBananas(B) };
    expect(await settleBananas(order[0])).toBe(0); // 평소 정산은 기능 전 게임을 안 준다

    const plan = (await retroBananaPlan()).filter((r) => P.includes(r.kakaoId));
    expect(plan.find((r) => r.kakaoId === order[0])).toMatchObject({ games: 1, bananas: 3 });
    expect(plan.find((r) => r.kakaoId === order[1])).toMatchObject({ games: 1, bananas: 1 });

    await applyRetroBananas(P);
    await applyRetroBananas(P);
    expect(await bananaBalance(order[0])).toBe(before[order[0]] + 3);
    expect(await bananaBalance(order[1])).toBe(before[order[1]] + 1);
    expect((await retroBananaPlan()).filter((r) => P.includes(r.kakaoId))).toEqual([]);
    const reasons = (await getSql()`select distinct reason from uk_banana_ledger where ref_id = ${g.id} order by reason`) as { reason: string }[];
    expect(reasons.map((r) => r.reason)).toEqual(["retro_play", "retro_win"]);
  });
});
