import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { deleteAccount } from "./account-delete";
import { createFanfare, createRoom, deleteRoom, enterRoom, joinFanfare } from "@/lib/ukiki/rooms";
import { upsertLocation } from "@/lib/birthday-gacha/locations";
import { saveSubscription } from "@/lib/birthday-gacha/push";

// 회원 탈퇴 (구글 플레이 정책: 앱 안에서 계정 삭제). 실제 DB.
//   내가 만든 방이 남아 있으면 탈퇴할 수 없다 → 먼저 방을 없앤다
//   탈퇴한 사람의 게임 기록은 '알 수 없음'으로 남는다
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-del-me", "test-del-friend"];
const [ME, F] = P;

describe.skipIf(!hasDb)("회원 탈퇴 (실제 DB)", () => {
  let mine = "";
  let friends = "";
  let fanfareId = 0;

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname, profile_image) values (${p}, ${p}, 'https://img/x.jpg') on conflict do nothing`;
    const a = await createRoom(ME, { name: "테스트 탈퇴 내 방", visibility: "public" });
    const b = await createRoom(F, { name: "테스트 탈퇴 친구 방", visibility: "public" });
    if (!a.ok || !b.ok) throw new Error("방 실패");
    mine = a.code;
    friends = b.code;
    await enterRoom(friends, ME);
    const f = await createFanfare(friends, F);
    if (f.kind !== "created") throw new Error("빵빠레 실패");
    fanfareId = f.id;
    await joinFanfare(friends, fanfareId, ME);
    await upsertLocation(ME, { lat: 37.5, lng: 127, accuracy: 10 });
    await saveSubscription(ME, { endpoint: "https://push.test/del-me", keys: { p256dh: "x", auth: "y" } }, "test");
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where code = any(${[mine, friends]})`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  it("내가 만든 방이 남아 있으면 탈퇴할 수 없고, 어떤 방인지 알려 준다", async () => {
    expect(await deleteAccount(ME)).toEqual({ ok: false, reason: "owns_rooms", rooms: [{ code: mine, name: "테스트 탈퇴 내 방" }] });
    const rows = (await getSql()`select deleted_at from players where kakao_id = ${ME}`) as { deleted_at: string | null }[];
    expect(rows[0].deleted_at).toBeNull();
  });

  it("방은 만든 사람만 없앨 수 있다", async () => {
    expect(await deleteRoom(friends, ME)).toBe(false);
    expect(await deleteRoom(mine, ME)).toBe(true);
    expect(await getSql()`select 1 from uk_rooms where code = ${mine}`).toEqual([]);
  });

  it("방을 다 없애면 탈퇴된다", async () => {
    expect(await deleteAccount(ME)).toEqual({ ok: true });
  });

  it("이름은 '알 수 없음'으로 바꾸고 사진은 지운다", async () => {
    const rows = (await getSql()`select nickname, profile_image, deleted_at from players where kakao_id = ${ME}`) as {
      nickname: string | null;
      profile_image: string | null;
      deleted_at: string | null;
    }[];
    expect(rows[0]).toMatchObject({ nickname: "알 수 없음", profile_image: null });
    expect(rows[0].deleted_at).not.toBeNull();
  });

  it("위치와 알림 기기를 지운다", async () => {
    const sql = getSql();
    expect(await sql`select 1 from player_locations where kakao_id = ${ME}`).toEqual([]);
    expect(await sql`select 1 from push_subscriptions where kakao_id = ${ME}`).toEqual([]);
  });

  it("친구 방에서는 나가고, 함께 한 게임 기록은 남는다", async () => {
    const sql = getSql();
    expect(await sql`select 1 from uk_room_members where kakao_id = ${ME}`).toEqual([]);
    const rows = (await sql`select 1 from uk_game_participants where game_id = ${fanfareId} and kakao_id = ${ME}`) as unknown[];
    expect(rows.length).toBe(1);
  });
});
