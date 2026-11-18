import { getSql } from "@/lib/db";
import { LOCATION_STALE_MS } from "@/lib/birthday-gacha/geo";
import type { PlayerLocation } from "@/lib/birthday-gacha/locations";

/** 방 지도: 그 방 멤버들의 최근 위치만. 내가 멤버가 아니면 null */
export async function listRoomLocations(code: string, me: string): Promise<PlayerLocation[] | null> {
  const sql = getSql();
  const member = (await sql`
    select 1 from uk_room_members where room_code = ${code} and kakao_id = ${me}
  `) as unknown[];
  if (member.length === 0) return null;

  const staleSeconds = Math.round(LOCATION_STALE_MS / 1000);
  const rows = (await sql`
    select l.kakao_id, p.nickname, p.profile_image, l.lat, l.lng, l.accuracy, l.updated_at
    from uk_room_members m
    join player_locations l on l.kakao_id = m.kakao_id
    join players p on p.kakao_id = m.kakao_id
    where m.room_code = ${code}
      and l.updated_at > now() - make_interval(secs => ${staleSeconds})
  `) as {
    kakao_id: string;
    nickname: string | null;
    profile_image: string | null;
    lat: number;
    lng: number;
    accuracy: number;
    updated_at: string;
  }[];
  return rows.map((r) => ({
    kakaoId: r.kakao_id,
    nickname: r.nickname,
    image: r.profile_image,
    lat: r.lat,
    lng: r.lng,
    accuracy: r.accuracy,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}
