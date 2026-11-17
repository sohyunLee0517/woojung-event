-- 카카오 계정 하나 = 플레이어 하나
create table if not exists players (
  kakao_id      text primary key,
  nickname      text,
  profile_image text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  login_count   integer     not null default 1
);
