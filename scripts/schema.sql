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

-- 웹 푸시 구독. 기기(브라우저)마다 하나씩 생긴다.
create table if not exists push_subscriptions (
  endpoint   text        primary key,
  kakao_id   text        not null references players(kakao_id) on delete cascade,
  p256dh     text        not null,
  auth       text        not null,
  user_agent text,
  created_at timestamptz not null default now()
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
alter table uk_room_games add constraint uk_room_games_game_type_check check (game_type in ('fanfare', 'gacha', 'pirate', 'snack', 'pinball', 'ai'))
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
alter table uk_room_games add constraint uk_room_games_game_type_check check (game_type in ('fanfare', 'gacha', 'pirate', 'snack', 'pinball', 'ai'))
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

-- ===== 바나나 (게임 보상) =====
-- 지갑: 잔액 한 줄. 쓸 때 "잔액 >= n 인 줄만 깎기"로 동시에 눌러도 마이너스가 안 된다.
create table if not exists uk_banana_wallets (
  kakao_id   text        primary key,
  balance    int         not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- 장부: 바나나가 들어오고 나간 기록. 게임 보상(play/win)과 환불(refund)은 같은 대상에 한 번만.
--   play/win 의 ref_id = uk_room_games.id, refund 의 ref_id = 환불한 prompt 줄의 id
create table if not exists uk_banana_ledger (
  id         bigserial   primary key,
  kakao_id   text        not null,
  delta      int         not null,
  reason     text        not null check (reason in ('play', 'win', 'prompt', 'refund', 'grant')),
  ref_id     bigint,
  created_at timestamptz not null default now()
);
create unique index if not exists uk_banana_once
  on uk_banana_ledger (kakao_id, reason, ref_id) where reason in ('play', 'win', 'refund')
;
create index if not exists uk_banana_by_user on uk_banana_ledger (kakao_id, created_at desc)
;

-- ===== AI 게임 만들기 =====
-- 방 안에서 만든 게임. draft(만드는 중) → published(방 사람들이 할 수 있음) / hidden(신고로 숨김)
create table if not exists uk_ai_games (
  id                bigserial   primary key,
  room_code         text        not null references uk_rooms(code) on delete cascade,
  creator_kakao_id  text        not null,
  title             text        not null default '이름 없는 게임',
  emoji             text        not null default '🎮',
  status            text        not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  published_version int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists uk_ai_games_room on uk_ai_games (room_code, status)
;

-- 프롬프트 한 번 = 버전 하나 (게임 코드 전체를 저장한다)
create table if not exists uk_ai_game_versions (
  ai_game_id bigint      not null references uk_ai_games(id) on delete cascade,
  version    int         not null,
  prompt     text        not null,
  html       text        not null,
  title      text        not null,
  emoji      text        not null,
  rules      text,
  created_at timestamptz not null default now(),
  primary key (ai_game_id, version)
);

-- 방에서 AI 게임 한 판 (다른 게임과 같은 준비완료 → 3·2·1 → 결과 흐름)
alter table uk_room_games drop constraint if exists uk_room_games_game_type_check
;
alter table uk_room_games add constraint uk_room_games_game_type_check check (game_type in ('fanfare', 'gacha', 'pirate', 'snack', 'pinball', 'ai'))
;
create unique index if not exists uk_one_active_ai
  on uk_room_games (room_code) where game_type = 'ai' and status = 'active'
;

create table if not exists uk_ai_rounds (
  game_id      bigint      primary key references uk_room_games(id) on delete cascade,
  ai_game_id   bigint      not null references uk_ai_games(id) on delete cascade,
  version      int         not null,
  started_at   timestamptz,
  seed         bigint,
  members      text[],
  ended_at     timestamptz,
  winners      text[],
  team_success boolean
);

create table if not exists uk_ai_round_players (
  game_id   bigint      not null references uk_room_games(id) on delete cascade,
  kakao_id  text        not null,
  ready     boolean     not null default false,
  joined_at timestamptz not null default clock_timestamp(),
  score     double precision,
  primary key (game_id, kakao_id)
);

-- 게임 안에서 주고받은 메시지 (모두 같은 순서로 받는다)
create table if not exists uk_ai_round_events (
  id       bigserial   primary key,
  game_id  bigint      not null references uk_room_games(id) on delete cascade,
  kakao_id text        not null,
  data     jsonb       not null,
  at       timestamptz not null default now()
);
create index if not exists uk_ai_round_events_game on uk_ai_round_events (game_id, id)
;

-- 신고: 어떤 AI 게임인지
alter table uk_reports add column if not exists ai_game_id bigint
;

-- AI 가 만드는 중인 요청 (만드는 데 1~3분 걸려서 뒤에서 돌린다)
alter table uk_ai_games add column if not exists pending_prompt text
;
alter table uk_ai_games add column if not exists pending_ledger_id bigint
;
alter table uk_ai_games add column if not exists pending_since timestamptz
;
alter table uk_ai_games add column if not exists last_error text
;

-- AI 게임: 만든 사람이 지우면 deleted (지난 게임 기록은 남긴다). 임시저장(draft)은 방마다 한 사람에 1개.
alter table uk_ai_games drop constraint if exists uk_ai_games_status_check
;
alter table uk_ai_games add constraint uk_ai_games_status_check check (status in ('draft', 'published', 'hidden', 'deleted'))
;
create unique index if not exists uk_ai_one_draft
  on uk_ai_games (room_code, creator_kakao_id) where status = 'draft'
;

-- AI 가 내용 기준(13세) 때문에 만들지 않고 제안한 대안 게임 (1~2개)
alter table uk_ai_games add column if not exists last_suggestions text[]
;

-- 바나나 소급 정산: 기능 전에 끝난 게임도 같은 규칙으로 한 번만 (사유 retro_play / retro_win)
alter table uk_banana_ledger drop constraint if exists uk_banana_ledger_reason_check
;
alter table uk_banana_ledger add constraint uk_banana_ledger_reason_check check (reason in ('play', 'win', 'prompt', 'refund', 'grant', 'retro_play', 'retro_win'))
;
create unique index if not exists uk_banana_retro_once
  on uk_banana_ledger (kakao_id, reason, ref_id) where reason in ('retro_play', 'retro_win')
;

-- 확정 전 자동 테스트 결과(버전마다)와 자동 수정 횟수 (사용자 프롬프트 한 번마다 최대 3번, 바나나 없음)
alter table uk_ai_game_versions add column if not exists tested_ok boolean
;
alter table uk_ai_game_versions add column if not exists test_problems text[]
;
alter table uk_ai_games add column if not exists autofix_count int not null default 0
;
alter table uk_ai_games add column if not exists pending_fix text[]
;

-- ===== 레거시 정리 (2026-11-26) =====
-- 퀴즈·특수카드·퀴즈 알림 기록 테이블은 기능을 없애면서 지운다.
drop table if exists quiz_attempts
;
drop table if exists player_cards
;
drop table if exists push_notifications
;
