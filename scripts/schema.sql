-- 카카오 계정 하나 = 플레이어 하나
create table if not exists players (
  kakao_id      text primary key,
  nickname      text,
  profile_image text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  login_count   integer     not null default 1
);

-- 플레이어별 마지막 현재 위치 (지도에 캐릭터 표시용, 사이트를 열어 둔 동안만 갱신)
create table if not exists player_locations (
  kakao_id   text primary key references players(kakao_id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  accuracy   double precision not null, -- 미터 단위 오차 반경
  updated_at timestamptz      not null default now()
);
