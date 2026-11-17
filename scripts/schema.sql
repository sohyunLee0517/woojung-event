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

-- 게임 방. code 로 초대 링크를 만든다.
create table if not exists games (
  code          text primary key,
  host_kakao_id text        not null references players(kakao_id),
  created_at    timestamptz not null default now()
);

-- 방에 참가한 플레이어와 현재 상태
create table if not exists game_players (
  game_code    text        not null references games(code) on delete cascade,
  kakao_id     text        not null references players(kakao_id) on delete cascade,
  seat         integer     not null,
  tickets      integer     not null default 0,
  money        integer     not null default 0,
  minutes      integer     not null default 0,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (game_code, kakao_id),
  unique (game_code, seat)
);

-- 방마다 섞어 둔 캡슐. slot 순서대로 뽑히고, 뽑히기 전 내용은 화면에 내려주지 않는다.
create table if not exists capsules (
  game_code text        not null references games(code) on delete cascade,
  slot      integer     not null,
  grade     text        not null,
  amount    integer     not null,
  minutes   integer     not null,
  drawn_by  text        references players(kakao_id),
  drawn_at  timestamptz,
  primary key (game_code, slot)
);

-- 뽑기권 퀴즈 참여 기록. 2시간 구간(window_start)마다 한 번만 풀 수 있다.
create table if not exists quiz_attempts (
  game_code    text        not null references games(code) on delete cascade,
  kakao_id     text        not null references players(kakao_id) on delete cascade,
  window_start timestamptz not null,
  question_id  text        not null,
  choice       integer,
  correct      boolean,
  issued_at    timestamptz not null default now(),
  answered_at  timestamptz,
  primary key (game_code, kakao_id, window_start)
);

-- 퀴즈로 얻은 특수카드. used_at 이 비어 있으면 아직 안 쓴 카드.
create table if not exists player_cards (
  id          bigserial   primary key,
  game_code   text        not null references games(code) on delete cascade,
  kakao_id    text        not null references players(kakao_id) on delete cascade,
  card_type   text        not null,
  acquired_at timestamptz not null default now(),
  used_at     timestamptz
);
