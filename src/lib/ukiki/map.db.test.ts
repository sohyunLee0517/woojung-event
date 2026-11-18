import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { upsertLocation } from "@/lib/birthday-gacha/locations";
import { listRoomLocations } from "./map";
import { createRoom, enterRoom } from "./rooms";

// 방별 지도: 같은 방 친구 위치만 보인다 (실제 DB)
const hasDb = !!process.env.DATABASE_URL;
const [A, B, OUT] = ["test-map-a", "test-map-b", "test-map-out"];

describe.skipIf(!hasDb)("방별 지도 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const id of [A, B, OUT]) {
      await sql`insert into players (kakao_id, nickname) values (${id}, ${id}) on conflict do nothing`;
    }
    const r = await createRoom(A, { name: "테스트 지도방", visibility: "public" });
    if (!r.ok) throw new Error("방 생성 실패");
    room = r.code;
    await enterRoom(room, B);
    for (const [i, id] of [A, B, OUT].entries()) {
      await upsertLocation(id, { lat: 34.66 + i * 0.001, lng: 135.5, accuracy: 10 });
    }
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from players where kakao_id in (${A}, ${B}, ${OUT})`;
  });

  it("방 멤버는 같은 방 친구들 위치만 본다 (다른 방 사람은 안 보임)", async () => {
    const locs = await listRoomLocations(room, A);
    expect(locs?.map((l) => l.kakaoId).sort()).toEqual([A, B].sort());
  });

  it("방 멤버가 아니면 그 방 지도를 볼 수 없다", async () => {
    expect(await listRoomLocations(room, OUT)).toBeNull();
  });

  it("나중에 들어온 멤버도 바로 지도에 보인다", async () => {
    await enterRoom(room, OUT);
    const locs = await listRoomLocations(room, A);
    expect(locs?.map((l) => l.kakaoId)).toContain(OUT);
  });
});
