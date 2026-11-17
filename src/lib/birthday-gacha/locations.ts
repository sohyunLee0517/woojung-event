import { getSql } from "@/lib/db";
import { LOCATION_STALE_MS } from "@/lib/birthday-gacha/geo";

export type PlayerLocation = {
  kakaoId: string;
  nickname: string | null;
  image: string | null;
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: string;
};

export async function upsertLocation(
  kakaoId: string,
  loc: { lat: number; lng: number; accuracy: number },
) {
  const sql = getSql();
  await sql`
    insert into player_locations (kakao_id, lat, lng, accuracy, updated_at)
    values (${kakaoId}, ${loc.lat}, ${loc.lng}, ${loc.accuracy}, now())
    on conflict (kakao_id) do update set
      lat = excluded.lat,
      lng = excluded.lng,
      accuracy = excluded.accuracy,
      updated_at = now()
  `;
}

export async function deleteLocation(kakaoId: string) {
  const sql = getSql();
  await sql`delete from player_locations where kakao_id = ${kakaoId}`;
}

/** 최근에 갱신된 위치만 (오래된 위치는 지도에서 숨긴다) */
export async function listRecentLocations(): Promise<PlayerLocation[]> {
  const sql = getSql();
  const staleSeconds = Math.round(LOCATION_STALE_MS / 1000);
  const rows = (await sql`
    select l.kakao_id, p.nickname, p.profile_image, l.lat, l.lng, l.accuracy, l.updated_at
    from player_locations l
    join players p on p.kakao_id = l.kakao_id
    where l.updated_at > now() - make_interval(secs => ${staleSeconds})
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
