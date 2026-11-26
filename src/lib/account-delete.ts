// 회원 탈퇴 (구글 플레이 정책: 앱 안에서 계정을 지울 수 있어야 한다).
//   먼저: 내가 만든 방이 남아 있으면 탈퇴할 수 없다 (방을 다 없앤 뒤에)
//   지우는 것: 사진, 마지막 위치, 알림 기기, 알림 기록, 친구 방 멤버십
//   남기는 것: 친구들과 함께 한 게임 기록 — 이름은 '알 수 없음'으로
import { getSql } from "@/lib/db";
import { ownedRooms } from "@/lib/ukiki/rooms";

export const DELETED_NAME = "알 수 없음";

export type DeleteAccountResult = { ok: true } | { ok: false; reason: "owns_rooms"; rooms: { code: string; name: string }[] };

export async function deleteAccount(kakaoId: string): Promise<DeleteAccountResult> {
  const rooms = await ownedRooms(kakaoId);
  if (rooms.length > 0) return { ok: false, reason: "owns_rooms", rooms };

  const sql = getSql();
  const memberOf = (await sql`select room_code from uk_room_members where kakao_id = ${kakaoId}`) as { room_code: string }[];
  for (const r of memberOf) await sql`select * from uk_leave_room(${r.room_code}, ${kakaoId})`;
  await sql`delete from player_locations where kakao_id = ${kakaoId}`;
  await sql`delete from push_subscriptions where kakao_id = ${kakaoId}`;
  await sql`update players set nickname = ${DELETED_NAME}, profile_image = null, deleted_at = now() where kakao_id = ${kakaoId}`;
  return { ok: true };
}
