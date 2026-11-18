import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import {
  createFanfare,
  createRoom,
  endFanfare,
  enterRoom,
  getRoomDetail,
  joinFanfare,
  leaveRoom,
  listPastGames,
  listRooms,
} from "./rooms";

// 방 나가기 (실제 DB)
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-leave-1", "test-leave-2", "test-leave-3", "test-leave-4"];
const [A, B, C, D] = P;

async function owner(code: string) {
  const sql = getSql();
  const rows = (await sql`select owner_kakao_id from uk_rooms where code = ${code}`) as { owner_kakao_id: string }[];
  return rows[0]?.owner_kakao_id ?? null;
}

async function roomExists(code: string) {
  return (await owner(code)) !== null;
}

async function newRoom(name: string, members: string[], visibility: "public" | "private" = "public") {
  const r = await createRoom(members[0], { name, visibility, password: "1234" });
  if (!r.ok) throw new Error(r.error);
  for (const m of members.slice(1)) await enterRoom(r.code, m, "1234");
  return r.code;
}

describe.skipIf(!hasDb)("방 나가기 (실제 DB)", () => {
  beforeAll(async () => {
    const sql = getSql();
    for (const id of P) await sql`insert into players (kakao_id, nickname) values (${id}, ${id}) on conflict do nothing`;
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = any(${P})`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("멤버가 나가면 더 이상 멤버가 아니고, 로비에서도 '참여 중'이 사라진다", async () => {
    const code = await newRoom("테스트 나가기1", [A, B]);
    expect(await leaveRoom(code, B)).toEqual({ ok: true, roomDeleted: false });
    expect(await getRoomDetail(code, B)).toBeNull();
    const mine = await listRooms(B, { q: "테스트 나가기1", offset: 0, limit: 20 });
    expect(mine.items.find((r) => r.code === code)?.isMember).toBe(false);
  });

  it("비밀방에서 나갔다가 다시 오면 비밀번호를 다시 묻는다", async () => {
    const code = await newRoom("테스트 나가기 비밀", [A, B], "private");
    await leaveRoom(code, B);
    expect(await enterRoom(code, B)).toBe("need_password");
  });

  it("방장이 나가면 가장 먼저 들어온 멤버가 방장이 된다", async () => {
    const code = await newRoom("테스트 방장 넘기기", [A, B, C]);
    await leaveRoom(code, A);
    expect(await owner(code)).toBe(B);
  });

  it("마지막 한 명이 나가면 방이 없어진다", async () => {
    const code = await newRoom("테스트 마지막", [A]);
    expect(await leaveRoom(code, A)).toEqual({ ok: true, roomDeleted: true });
    expect(await roomExists(code)).toBe(false);
  });

  it("멤버가 아니면 나갈 수 없다", async () => {
    const code = await newRoom("테스트 비멤버", [A]);
    expect(await leaveRoom(code, D)).toEqual({ ok: false, reason: "not_member" });
  });

  it("진행 중인 빵빠레 호스트가 나가면 그 빵빠레는 끝나고, 다른 사람이 새로 열 수 있다", async () => {
    const code = await newRoom("테스트 호스트 나감", [A, B]);
    const f = await createFanfare(code, B);
    expect(f.kind).toBe("created");
    await leaveRoom(code, B);
    expect((await getRoomDetail(code, A))?.games).toHaveLength(0);
    expect((await createFanfare(code, A)).kind).toBe("created");
  });

  it("나간 사람이 참여했던 지난 게임 기록은 남은 멤버에게 그대로 보인다", async () => {
    const code = await newRoom("테스트 기록 유지", [A, B]);
    const f = await createFanfare(code, A);
    if (f.kind !== "created") throw new Error("빵빠레 실패");
    await joinFanfare(code, f.id, B);
    await endFanfare(code, f.id, A);
    await leaveRoom(code, B);
    const past = await listPastGames(code, A);
    expect(past?.items[0].participants.map((p) => p.kakaoId).sort()).toEqual([A, B].sort());
  });

  it("동시성: 방장과 다른 멤버가 동시에 나가도 남은 방의 방장은 항상 멤버다", async () => {
    const code = await newRoom("테스트 동시 나가기", [A, B, C]);
    await Promise.all([leaveRoom(code, A), leaveRoom(code, B)]);
    expect(await owner(code)).toBe(C);
    expect((await getRoomDetail(code, C))?.members.map((m) => m.kakaoId)).toEqual([C]);
  });

  it("동시성: 마지막 두 명이 동시에 나가면 방이 깔끔하게 없어진다 (에러 없이)", async () => {
    const code = await newRoom("테스트 동시 마지막", [A, B]);
    const results = await Promise.all([leaveRoom(code, A), leaveRoom(code, B)]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && r.roomDeleted)).toHaveLength(1);
    expect(await roomExists(code)).toBe(false);
  });

  it("동시성: 같은 사람이 나가기를 여러 번 눌러도 한 번만 처리된다", async () => {
    const code = await newRoom("테스트 연타 나가기", [A, B, C]);
    const results = await Promise.all([leaveRoom(code, B), leaveRoom(code, B), leaveRoom(code, B)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(2);
    expect((await getRoomDetail(code, A))?.members.map((m) => m.kakaoId).sort()).toEqual([A, C].sort());
  });
});
