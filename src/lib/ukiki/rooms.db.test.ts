import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createFanfare, createRoom, endFanfare, enterRoom, listRooms } from "./rooms";

// 실제 DB로 확인하는 테스트. DATABASE_URL 이 있을 때만 돈다.
//   npm run test:db
const hasDb = !!process.env.DATABASE_URL;
const A = "test-ukiki-a";
const B = "test-ukiki-b";
const C = "test-ukiki-c";

describe.skipIf(!hasDb)("우끼끼 방 (실제 DB)", () => {
  let code = "";
  let secretCode = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const [id, name] of [
      [A, "테스트A"],
      [B, "테스트B"],
      [C, "테스트C"],
    ]) {
      await sql`insert into players (kakao_id, nickname) values (${id}, ${name}) on conflict do nothing`;
    }
    const room = await createRoom(A, { name: "테스트 공개방", visibility: "public" });
    const secret = await createRoom(A, { name: "테스트 비밀방", visibility: "private", password: "1234" });
    if (!room.ok || !secret.ok) throw new Error("방 생성 실패");
    code = room.code;
    secretCode = secret.code;
    await enterRoom(code, B);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from players where kakao_id in (${A}, ${B}, ${C})`;
  });

  it("비밀방은 비밀번호가 맞아야 멤버가 되고, 그다음엔 다시 묻지 않는다", async () => {
    expect(await enterRoom(secretCode, C)).toBe("need_password");
    expect(await enterRoom(secretCode, C, "0000")).toBe("wrong_password");
    expect(await enterRoom(secretCode, C, "1234")).toBe("enter");
    expect(await enterRoom(secretCode, C)).toBe("enter");
  });

  it("두 명이 동시에 빵빠레를 만들면 한 명만 호스트가 되고 다른 한 명은 나가기/참여하기를 고른다", async () => {
    const [ra, rb] = await Promise.all([createFanfare(code, A), createFanfare(code, B)]);
    const kinds = [ra.kind, rb.kind].sort();
    expect(kinds).toEqual(["conflict", "created"]);

    const created = (ra.kind === "created" ? ra : rb) as { kind: "created"; id: number };
    const conflict = (ra.kind === "conflict" ? ra : rb) as Extract<typeof ra, { kind: "conflict" }>;
    expect(conflict.active.id).toBe(created.id);
    expect(conflict.choices).toEqual(["leave", "join"]);
  });

  it("빵빠레가 끝나면 다시 새 빵빠레를 열 수 있다", async () => {
    const again = await createFanfare(code, B);
    expect(again.kind).toBe("conflict");
    const active = (again as Extract<typeof again, { kind: "conflict" }>).active;

    // 호스트가 아니면 못 끝낸다
    const notHost = active.hostKakaoId === A ? B : A;
    expect(await endFanfare(code, active.id, notHost)).toBe(false);
    expect(await endFanfare(code, active.id, active.hostKakaoId)).toBe(true);

    expect((await createFanfare(code, notHost)).kind).toBe("created");
  });

  it("방 이름으로 검색하고, 내 방만 골라 볼 수 있다", async () => {
    const found = await listRooms(B, { q: "테스트 비밀", offset: 0, limit: 20 });
    expect(found.items.map((r) => r.code)).toContain(secretCode);
    expect(found.items.map((r) => r.code)).not.toContain(code);

    const percent = await listRooms(B, { q: "%", offset: 0, limit: 20 });
    expect(percent.items.map((r) => r.code)).not.toContain(code);

    const mine = await listRooms(B, { q: "", offset: 0, limit: 20 }, { mineOnly: true });
    expect(mine.items.every((r) => r.isMember)).toBe(true);
    expect(mine.items.map((r) => r.code)).toContain(code);
    expect(mine.items.map((r) => r.code)).not.toContain(secretCode);
  });

  it("방 멤버가 아니면 빵빠레를 못 만든다", async () => {
    expect((await createFanfare(secretCode, B)).kind).toBe("not_member");
  });
});
