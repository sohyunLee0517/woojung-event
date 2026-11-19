import { getSql } from "@/lib/db";

export type Player = {
  kakao_id: string;
  nickname: string | null;
  profile_image: string | null;
  created_at: string;
  last_login_at: string;
  login_count: number;
};

// 카카오 로그인할 때마다 호출: 처음이면 새로 저장하고, 이미 있으면 닉네임·사진·로그인 시각을 갱신한다.
export async function upsertPlayer(input: {
  kakaoId: string;
  nickname: string | null;
  profileImage: string | null;
}) {
  const sql = getSql();
  await sql`
    insert into players (kakao_id, nickname, profile_image)
    values (${input.kakaoId}, ${input.nickname}, ${input.profileImage})
    on conflict (kakao_id) do update set
      nickname = excluded.nickname,
      profile_image = excluded.profile_image,
      last_login_at = now(),
      login_count = players.login_count + 1,
      deleted_at = null
  `;
}

export async function getPlayer(kakaoId: string): Promise<Player | null> {
  const sql = getSql();
  const rows = (await sql`
    select kakao_id, nickname, profile_image, created_at, last_login_at, login_count
    from players
    where kakao_id = ${kakaoId}
  `) as Player[];
  return rows[0] ?? null;
}
