import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startGachaNow } from "@/lib/ukiki/test-helpers";
import { getSql } from "@/lib/db";
import { drawCapsule, joinGame } from "@/lib/birthday-gacha/games";
import {
  createFanfare,
  createGachaInRoom,
  createRoom,
  endFanfare,
  enterRoom,
  getRoomDetail,
  joinFanfare,
  listPastGames,
} from "./rooms";

// 지난 게임 (실제 DB)
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-past-1", "test-past-2", "test-past-3", "test-past-new1", "test-past-new2"];
const [A, B, C, NEW1, NEW2] = P;

describe.skipIf(!hasDb)("지난 게임 (실제 DB)", () => {
  let room = "";
  let gacha = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const id of P) await sql`insert into players (kakao_id, nickname) values (${id}, ${id}) on conflict do nothing`;
    const r = await createRoom(A, { name: "테스트 지난게임방", visibility: "public" });
    if (!r.ok) throw new Error("방 생성 실패");
    room = r.code;
    await enterRoom(room, B);
    await enterRoom(room, C);

    // 빵빠레 한 판: A 호스트, B·C 참여 후 끝
    const f = await createFanfare(room, A);
    if (f.kind !== "created") throw new Error("빵빠레 생성 실패");
    await joinFanfare(room, f.id, B);
    await joinFanfare(room, f.id, C);
    await joinFanfare(room, f.id, C); // 두 번 들어와도 한 번
    await endFanfare(room, f.id, A);

    // 가챠 한 판: 3명이 9개 다 뽑기
    const made = await createGachaInRoom(room, A);
    if (made.kind !== "created") throw new Error("가챠 열기 실패");
    gacha = made.gachaCode;
    await joinGame(gacha, B);
    await joinGame(gacha, C);
    await startGachaNow(gacha);
    for (let i = 0; i < 3; i++) for (const p of [A, B, C]) await drawCapsule(gacha, p);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from games where host_kakao_id = ${A}`;
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("끝난 빵빠레와 다 뽑은 가챠가 지난 게임에 나온다 (진행 중 목록에서는 빠짐)", async () => {
    const past = await listPastGames(room, A);
    expect(past?.items.map((g) => g.type).sort()).toEqual(["fanfare", "gacha"]);
    const detail = await getRoomDetail(room, A);
    expect(detail?.games).toHaveLength(0);
  });

  it("빵빠레 결과: 호스트와 참여자", async () => {
    const past = await listPastGames(room, A);
    const f = past?.items.find((g) => g.type === "fanfare");
    expect(f?.hostKakaoId).toBe(A);
    expect(f?.participants.map((p) => p.kakaoId).sort()).toEqual([A, B, C].sort());
  });

  it("가챠 결과: 3명 금액·시간과 등수", async () => {
    const past = await listPastGames(room, A);
    const g = past?.items.find((x) => x.type === "gacha");
    expect(g?.gachaResult).toHaveLength(3);
    expect(g?.gachaResult?.[0].rank).toBe(1);
    const total = g?.gachaResult?.reduce((s, r) => s + r.money, 0);
    expect(total).toBe(31500); // 캡슐 9개 합계
  });

  it("3명이던 방에 2명이 새로 들어와도 이전 게임 기록을 다 볼 수 있다", async () => {
    await enterRoom(room, NEW1);
    await enterRoom(room, NEW2);
    for (const n of [NEW1, NEW2]) {
      const past = await listPastGames(room, n);
      expect(past?.items).toHaveLength(2);
      expect(past?.items.find((g) => g.type === "gacha")?.gachaResult).toHaveLength(3);
    }
  });

  it("방 멤버가 아니면 지난 게임을 볼 수 없다", async () => {
    expect(await listPastGames(room, "test-past-outsider")).toBeNull();
  });

  it("지난 게임도 20개씩 더보기", async () => {
    const sql = getSql();
    await sql`
      insert into uk_room_games (room_code, game_type, host_kakao_id, status, ended_at)
      select ${room}, 'fanfare', ${A}, 'ended', now() - make_interval(mins => i + 10)
      from generate_series(0, 20) i
    `;
    const first = await listPastGames(room, A);
    expect(first?.items).toHaveLength(20);
    expect(first?.nextOffset).toBe(20);
    const second = await listPastGames(room, A, 20);
    expect(second?.items).toHaveLength(3);
    expect(second?.nextOffset).toBeNull();
  });
});
