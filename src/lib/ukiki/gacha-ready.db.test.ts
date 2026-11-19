import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { drawCapsule, getGameState, joinGame, setGachaReady } from "@/lib/birthday-gacha/games";
import { createGachaInRoom, createRoom, enterRoom } from "./rooms";

// 가챠도 공통 흐름: 자리에 앉은 사람이 모두 준비완료 → 3·2·1 → 시작해야 뽑을 수 있다 (실제 DB)
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-gr-host", "test-gr-a"];
const [H, A] = P;

describe.skipIf(!hasDb)("가챠 준비완료 → 3·2·1 (실제 DB)", () => {
  let code = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    const r = await createRoom(H, { name: "테스트 가챠 준비", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    await enterRoom(r.code, A);
    const g = await createGachaInRoom(r.code, H);
    if (g.kind !== "created") throw new Error("가챠 실패");
    code = g.gachaCode;
    await joinGame(code, A);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${H}`;
    await sql`delete from games where host_kakao_id = any(${P})`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("시작 전에는 뽑을 수 없다", async () => {
    expect(await drawCapsule(code, H)).toEqual({ ok: false, reason: "not_started" });
    const s = await getGameState(code, H);
    expect(s?.startedAt).toBeNull();
    expect(s?.players.map((p) => p.ready)).toEqual([false, false]);
  });

  it("한 명만 준비하면 아직 시작하지 않는다", async () => {
    await setGachaReady(code, H, true);
    const s = await getGameState(code, H);
    expect(s?.startedAt).toBeNull();
    expect(s?.players.find((p) => p.kakaoId === H)?.ready).toBe(true);
  });

  it("모두 준비하면 3초 뒤로 시작 시각이 잡히고, 그 전엔 여전히 못 뽑는다", async () => {
    await setGachaReady(code, A, true);
    const s = await getGameState(code, A);
    const left = new Date(s!.startedAt!).getTime() - new Date(s!.serverNow).getTime();
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(3100);
    expect(await drawCapsule(code, A)).toEqual({ ok: false, reason: "not_started" });
  });

  it("시작 시각이 지나면 뽑을 수 있고, 준비를 취소해도 다시 멈추지 않는다", async () => {
    await getSql()`update games set started_at = now() - interval '1 second' where code = ${code}`;
    expect((await drawCapsule(code, A)).ok).toBe(true);
    await setGachaReady(code, A, false);
    expect((await getGameState(code, A))?.startedAt).not.toBeNull();
  });
});
