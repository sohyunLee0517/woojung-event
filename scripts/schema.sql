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

-- 웹 푸시 구독. 기기(브라우저)마다 하나씩 생긴다.
create table if not exists push_subscriptions (
  endpoint   text        primary key,
  kakao_id   text        not null references players(kakao_id) on delete cascade,
  p256dh     text        not null,
  auth       text        not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- 2시간 구간마다 퀴즈 알림을 한 번만 보내기 위한 기록
create table if not exists push_notifications (
  kakao_id     text        not null references players(kakao_id) on delete cascade,
  window_start timestamptz not null,
  sent_at      timestamptz not null default now(),
  primary key (kakao_id, window_start)
);

-- 알림은 마지막으로 접속한 기기 한 대에만 보낸다. 방 화면을 열 때마다 갱신된다.
alter table push_subscriptions add column if not exists last_seen_at timestamptz not null default now();

-- ===== 우끼끼(우리끼리): 방 안에서 여러 게임을 한다 =====

-- 친구들이 모이는 방. 비밀방은 비밀번호 해시만 저장한다.
create table if not exists uk_rooms (
  code           text        primary key,
  name           text        not null,
  owner_kakao_id text        not null references players(kakao_id),
  visibility     text        not null check (visibility in ('public', 'private')),
  password_hash  text,
  created_at     timestamptz not null default now()
);

-- 방 멤버. 비밀방은 한 번 비밀번호를 맞히면 멤버가 되어 다시 묻지 않는다.
create table if not exists uk_room_members (
  room_code    text        not null references uk_rooms(code) on delete cascade,
  kakao_id     text        not null references players(kakao_id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_code, kakao_id)
);

-- 방 안에서 열린 게임 한 판. 가챠는 ref_code 로 기존 가챠 게임을 가리킨다.
create table if not exists uk_room_games (
  id            bigserial   primary key,
  room_code     text        not null references uk_rooms(code) on delete cascade,
  game_type     text        not null check (game_type in ('fanfare', 'gacha')),
  host_kakao_id text        not null references players(kakao_id),
  status        text        not null default 'active' check (status in ('active', 'ended')),
  ref_code      text,
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);

-- 방마다 진행 중인 빵빠레는 1개만 (동시에 만들어도 DB가 하나만 받아 준다)
create unique index if not exists uk_one_active_fanfare
  on uk_room_games (room_code) where game_type = 'fanfare' and status = 'active'
;

-- 재촉하기: 같은 게임은 1분에 한 번만 (마지막으로 재촉한 시각)
alter table uk_room_games add column if not exists last_nudged_at timestamptz;

-- 캡슐을 다 뽑은 가챠는 끝난 게임으로 (새 가챠를 열 수 있게)
update uk_room_games g set status = 'ended', ended_at = now(), outcome = 'completed'
where g.game_type = 'gacha' and g.status = 'active'
  and exists (select 1 from capsules c where c.game_code = g.ref_code)
  and not exists (select 1 from capsules c where c.game_code = g.ref_code and c.drawn_by is null)
;

-- 이미 중복으로 열린 가챠는 처음 만든 것만 남긴다
update uk_room_games g set status = 'ended', ended_at = now(), outcome = 'cancelled'
where g.game_type = 'gacha' and g.status = 'active'
  and exists (
    select 1 from uk_room_games o
    where o.room_code = g.room_code and o.game_type = 'gacha' and o.status = 'active'
      and (o.created_at, o.id) < (g.created_at, g.id))
;

-- 방마다 진행 중인 생일 가챠도 1개만
create unique index if not exists uk_one_active_gacha
  on uk_room_games (room_code) where game_type = 'gacha' and status = 'active'
;

-- 가챠 뽑기 1번. 플레이어 줄을 잠근 채로 뽑기권·최대 횟수를 확인해서
-- 같은 사람이 연타해도 정해진 횟수 넘게 뽑히지 않는다.
create or replace function bg_draw_capsule(p_code text, p_kakao text, p_max int)
returns table (out_grade text, out_amount int, out_minutes int, out_reason text)
language plpgsql as $$
declare
  v_tickets int;
  v_drawn int;
  v_slot int;
  v_grade text;
  v_amount int;
  v_minutes int;
begin
  select gp.tickets into v_tickets from game_players gp
  where gp.game_code = p_code and gp.kakao_id = p_kakao
  for update;
  if not found then
    return query select null::text, null::int, null::int, 'not_member'::text;
    return;
  end if;
  if v_tickets <= 0 then
    return query select null::text, null::int, null::int, 'no_ticket'::text;
    return;
  end if;

  -- 모든 게임은 2명 이상부터
  if (select count(*) from game_players gp where gp.game_code = p_code) < 2 then
    return query select null::text, null::int, null::int, 'need_players'::text;
    return;
  end if;

  -- 모두 준비완료 → 3·2·1 이 끝나야 뽑을 수 있다
  if not exists (select 1 from games g where g.code = p_code and g.started_at is not null and g.started_at <= now()) then
    return query select null::text, null::int, null::int, 'not_started'::text;
    return;
  end if;

  select count(*) into v_drawn from capsules c where c.game_code = p_code and c.drawn_by = p_kakao;
  if v_drawn >= p_max then
    return query select null::text, null::int, null::int, 'no_ticket'::text;
    return;
  end if;

  select c.slot into v_slot from capsules c
  where c.game_code = p_code and c.drawn_by is null
  order by c.slot limit 1
  for update skip locked;
  if v_slot is null then
    if exists (select 1 from capsules c where c.game_code = p_code and c.drawn_by is null) then
      return query select null::text, null::int, null::int, 'busy'::text;
    else
      return query select null::text, null::int, null::int, 'empty'::text;
    end if;
    return;
  end if;

  update capsules c set drawn_by = p_kakao, drawn_at = now()
  where c.game_code = p_code and c.slot = v_slot
  returning c.grade, c.amount, c.minutes into v_grade, v_amount, v_minutes;

  update game_players gp
  set tickets = gp.tickets - 1, money = gp.money + v_amount, minutes = gp.minutes + v_minutes
  where gp.game_code = p_code and gp.kakao_id = p_kakao;

  -- 마지막 캡슐이면 방의 가챠를 끝난 게임으로
  if not exists (select 1 from capsules c where c.game_code = p_code and c.drawn_by is null) then
    update uk_room_games g set status = 'ended', ended_at = now(), outcome = 'completed'
    where g.ref_code = p_code and g.game_type = 'gacha' and g.status = 'active';
  end if;

  return query select v_grade, v_amount, v_minutes, null::text;
end;
$$
;

-- 게임 한 판에 참여한 사람 (빵빠레는 화면에 들어온 사람, 가챠는 game_players 를 쓴다)
create table if not exists uk_game_participants (
  game_id   bigint      not null references uk_room_games(id) on delete cascade,
  kakao_id  text        not null references players(kakao_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, kakao_id)
)
;

-- 방 나가기. 방 줄을 잠그고 처리해서 여럿이 동시에 나가도 꼬이지 않는다.
--  · 진행 중인 빵빠레를 열어 둔 사람이 나가면 그 빵빠레는 끝난다
--  · 방장이 나가면 가장 먼저 들어온 멤버가 방장이 된다
--  · 마지막 한 명이 나가면 방이 없어진다
create or replace function uk_leave_room(p_code text, p_kakao text)
returns table (out_ok boolean, out_reason text, out_deleted boolean)
language plpgsql as $$
declare
  v_owner text;
  v_next text;
begin
  select r.owner_kakao_id into v_owner from uk_rooms r where r.code = p_code for update;
  if not found then
    return query select false, 'not_member'::text, false;
    return;
  end if;

  delete from uk_room_members m where m.room_code = p_code and m.kakao_id = p_kakao;
  if not found then
    return query select false, 'not_member'::text, false;
    return;
  end if;

  update uk_room_games g set status = 'ended', ended_at = now(), outcome = 'aborted'
  where g.room_code = p_code and g.game_type = 'fanfare' and g.status = 'active' and g.host_kakao_id = p_kakao;

  select m.kakao_id into v_next from uk_room_members m
  where m.room_code = p_code
  order by m.joined_at, m.kakao_id
  limit 1;

  if v_next is null then
    delete from uk_rooms r where r.code = p_code;
    return query select true, null::text, true;
    return;
  end if;

  if v_owner = p_kakao then
    update uk_rooms r set owner_kakao_id = v_next where r.code = p_code;
  end if;
  return query select true, null::text, false;
end;
$$
;

-- 빵빠레 결과: 참여자별 탭 수
alter table uk_game_participants add column if not exists taps integer
;

-- 빵빠레가 어떻게 끝났는지: completed(공개까지) / aborted(진행 중 중단) / cancelled(시작 전 닫기)
alter table uk_room_games add column if not exists outcome text
;

-- 피처 토글: 관리자가 게임별로 켜고 끈다. 행이 없으면 켜진 것으로 본다.
create table if not exists uk_feature_flags (
  key        text        primary key,
  enabled    boolean     not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- 회원 탈퇴: 이름·사진·위치·알림 기기를 지우고 시각을 남긴다 (다시 로그인하면 새로 시작)
alter table players add column if not exists deleted_at timestamptz
;

-- 앱 안 신고하기 (아동 안전·괴롭힘 등). 관리자 페이지에서 본다.
create table if not exists uk_reports (
  id                bigserial   primary key,
  reporter_kakao_id text        not null,
  category          text        not null,
  body              text        not null,
  room_code         text,
  status            text        not null default 'open',
  created_at        timestamptz not null default now()
);

-- 가챠 준비완료 → 3·2·1 (모든 게임 공통 흐름). 이미 진행 중이던 가챠는 시작된 것으로 둔다.
alter table game_players add column if not exists ready boolean not null default false
;
alter table games add column if not exists started_at timestamptz
;
update games g set started_at = g.created_at
where g.started_at is null and exists (select 1 from capsules c where c.game_code = g.code and c.drawn_by is not null)
;

-- ===== 해적 무찌르기 / 과자 나눠먹기 =====
alter table uk_room_games drop constraint if exists uk_room_games_game_type_check
;
alter table uk_room_games add constraint uk_room_games_game_type_check check (game_type in ('fanfare', 'gacha', 'pirate', 'snack'))
;
create unique index if not exists uk_one_active_pirate
  on uk_room_games (room_code) where game_type = 'pirate' and status = 'active'
;

-- 해적 한 판. 함정 구멍은 끝날 때까지 화면에 내려주지 않는다.
create table if not exists uk_pirate_games (
  game_id    bigint      primary key references uk_room_games(id) on delete cascade,
  trap_hole  int         not null,
  started_at timestamptz,
  turn_order text[],
  status     text        not null default 'playing' check (status in ('playing', 'fail', 'success'))
);

-- 해적 참여자 (입장 순서 = 칼 꽂는 순서)
create table if not exists uk_pirate_players (
  game_id   bigint      not null references uk_room_games(id) on delete cascade,
  kakao_id  text        not null,
  ready     boolean     not null default false,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (game_id, kakao_id)
);

-- 꽂은 칼. seq(몇 번째 칼)와 hole(구멍)이 겹치지 않게 해서 동시에 눌러도 하나만 들어간다.
create table if not exists uk_pirate_stabs (
  game_id  bigint      not null references uk_room_games(id) on delete cascade,
  seq      int         not null,
  hole     int         not null,
  kakao_id text        not null,
  at       timestamptz not null default now(),
  primary key (game_id, seq),
  unique (game_id, hole)
);

create unique index if not exists uk_one_active_snack
  on uk_room_games (room_code) where game_type = 'snack' and status = 'active'
;

-- 과자 나눠먹기 한 판. members 는 시작할 때 들어와 있던 사람(자를 사람)
create table if not exists uk_snack_games (
  game_id    bigint      primary key references uk_room_games(id) on delete cascade,
  started_at timestamptz,
  members    text[],
  status     text        not null default 'playing' check (status in ('playing', 'fail', 'success')),
  total      int
);

create table if not exists uk_snack_players (
  game_id   bigint      not null references uk_room_games(id) on delete cascade,
  kakao_id  text        not null,
  ready     boolean     not null default false,
  joined_at timestamptz not null default clock_timestamp(),
  cut       int         check (cut between 1 and 100),
  cut_at    timestamptz,
  primary key (game_id, kakao_id)
);

-- ===== 랜덤 핀볼 =====
alter table uk_room_games drop constraint if exists uk_room_games_game_type_check
;
alter table uk_room_games add constraint uk_room_games_game_type_check check (game_type in ('fanfare', 'gacha', 'pirate', 'snack', 'pinball'))
;
create unique index if not exists uk_one_active_pinball
  on uk_room_games (room_code) where game_type = 'pinball' and status = 'active'
;

-- 핀볼 한 판. seed 로 판·구슬 움직임이 정해지고, result_order 는 그 시드로 서버가 계산한 도착 순서
create table if not exists uk_pinball_games (
  game_id      bigint      primary key references uk_room_games(id) on delete cascade,
  started_at   timestamptz,
  seed         bigint,
  members      text[],
  result_order text[]
);

create table if not exists uk_pinball_players (
  game_id   bigint      not null references uk_room_games(id) on delete cascade,
  kakao_id  text        not null,
  ready     boolean     not null default false,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (game_id, kakao_id)
);
