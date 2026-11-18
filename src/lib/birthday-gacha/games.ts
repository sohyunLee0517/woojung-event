import { randomInt } from "node:crypto";
import { getSql } from "@/lib/db";
import { getQuizStatus, type QuizStatus } from "@/lib/birthday-gacha/quiz";
import { pushDeviceCount } from "@/lib/birthday-gacha/push";
import {
  CAPSULE_SET,
  MAX_DRAWS_PER_PLAYER,
  MAX_PLAYERS,
  ONLINE_WITHIN_S,
  TICKETS_ON_JOIN,
  type CardType,
  type Grade,
} from "@/lib/birthday-gacha/rules";

// 헷갈리는 글자(0/O, 1/I/L)는 뺀 방 코드
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

/** 새 방을 만들고 캡슐 9개를 섞어 넣는다. 만든 사람은 바로 참가한다. */
export async function createGame(hostKakaoId: string): Promise<string> {
  const sql = getSql();
  const code = makeCode();
  const capsules = shuffled(CAPSULE_SET);
  await sql.transaction([
    sql`insert into games (code, host_kakao_id) values (${code}, ${hostKakaoId})`,
    ...capsules.map(
      (c, slot) => sql`
        insert into capsules (game_code, slot, grade, amount, minutes)
        values (${code}, ${slot}, ${c.grade}, ${c.amount}, ${c.minutes})
      `,
    ),
  ]);
  await joinGame(code, hostKakaoId);
  return code;
}

export type JoinResult = "joined" | "already" | "full" | "not_found";

/** 빈 자리에 앉힌다. 이미 참가했으면 그대로 둔다. */
export async function joinGame(code: string, kakaoId: string): Promise<JoinResult> {
  const sql = getSql();
  const game = (await sql`select code from games where code = ${code}`) as unknown[];
  if (game.length === 0) return "not_found";

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const rows = (await sql`
        insert into game_players (game_code, kakao_id, seat, tickets)
        select ${code}, ${kakaoId}, s.seat, ${TICKETS_ON_JOIN}
        from (
          select gs as seat from generate_series(1, ${MAX_PLAYERS}::int) gs
          where gs not in (select seat from game_players where game_code = ${code})
          order by gs limit 1
        ) s
        on conflict (game_code, kakao_id) do nothing
        returning seat
      `) as unknown[];
      if (rows.length > 0) return "joined";
      const member = (await sql`
        select 1 from game_players where game_code = ${code} and kakao_id = ${kakaoId}
      `) as unknown[];
      return member.length > 0 ? "already" : "full";
    } catch {
      // 두 사람이 동시에 같은 자리에 앉으려 하면 unique 오류가 난다. 다시 시도.
    }
  }
  return "full";
}

export type GamePlayer = {
  kakaoId: string;
  nickname: string | null;
  image: string | null;
  seat: number;
  tickets: number;
  money: number;
  minutes: number;
  online: boolean;
  isHost: boolean;
  /** 안 쓴 특수카드 수 (종류는 본인만 안다) */
  cardCount: number;
};

export type DrawnCapsule = {
  slot: number;
  grade: Grade;
  amount: number;
  minutes: number;
  drawnBy: string;
  drawnAt: string;
};

export type GameState = {
  code: string;
  me: string;
  isMember: boolean;
  players: GamePlayer[];
  totalCapsules: number;
  remainingCapsules: number;
  drawn: DrawnCapsule[];
  /** 내가 가진 안 쓴 특수카드 */
  myCards: { id: number; type: CardType; acquiredAt: string }[];
  /** 내 퀴즈 상태 (참가 전이면 null) */
  quiz: QuizStatus | null;
  /** 남은 시간 계산용 서버 시각 */
  serverNow: string;
  /** 푸시 알림을 등록한 내 기기 수 */
  pushDevices: number;
};

/** 화면에 내려줄 방 상태. 뽑히지 않은 캡슐의 내용은 포함하지 않는다. */
export async function getGameState(code: string, me: string): Promise<GameState | null> {
  const sql = getSql();
  const game = (await sql`select host_kakao_id from games where code = ${code}`) as {
    host_kakao_id: string;
  }[];
  if (game.length === 0) return null;
  const host = game[0].host_kakao_id;

  // 상태를 불러오는 것 자체를 접속 신호로 쓴다
  await sql`
    update game_players set last_seen_at = now()
    where game_code = ${code} and kakao_id = ${me}
  `;

  const players = (await sql`
    select gp.kakao_id, p.nickname, p.profile_image, gp.seat, gp.tickets, gp.money, gp.minutes,
           (now() - gp.last_seen_at) < make_interval(secs => ${ONLINE_WITHIN_S}) as online,
           (select count(*)::int from player_cards pc
             where pc.game_code = gp.game_code and pc.kakao_id = gp.kakao_id and pc.used_at is null) as card_count
    from game_players gp
    join players p on p.kakao_id = gp.kakao_id
    where gp.game_code = ${code}
    order by gp.seat
  `) as {
    kakao_id: string;
    nickname: string | null;
    profile_image: string | null;
    seat: number;
    tickets: number;
    money: number;
    minutes: number;
    online: boolean;
    card_count: number;
  }[];

  const myCards = (await sql`
    select id, card_type, acquired_at from player_cards
    where game_code = ${code} and kakao_id = ${me} and used_at is null
    order by acquired_at
  `) as { id: number; card_type: CardType; acquired_at: string }[];

  const capsules = (await sql`
    select slot, grade, amount, minutes, drawn_by, drawn_at
    from capsules where game_code = ${code}
  `) as {
    slot: number;
    grade: Grade;
    amount: number;
    minutes: number;
    drawn_by: string | null;
    drawn_at: string | null;
  }[];

  const drawn = capsules
    .filter((c) => c.drawn_by && c.drawn_at)
    .map((c) => ({
      slot: c.slot,
      grade: c.grade,
      amount: c.amount,
      minutes: c.minutes,
      drawnBy: c.drawn_by as string,
      drawnAt: new Date(c.drawn_at as string).toISOString(),
    }))
    .sort((a, b) => b.drawnAt.localeCompare(a.drawnAt));

  return {
    code,
    me,
    isMember: players.some((p) => p.kakao_id === me),
    players: players.map((p) => ({
      kakaoId: p.kakao_id,
      nickname: p.nickname,
      image: p.profile_image,
      seat: p.seat,
      tickets: p.tickets,
      money: p.money,
      minutes: p.minutes,
      online: p.online,
      isHost: p.kakao_id === host,
      cardCount: p.card_count,
    })),
    totalCapsules: capsules.length,
    remainingCapsules: capsules.length - drawn.length,
    drawn,
    myCards: myCards.map((c) => ({
      id: Number(c.id),
      type: c.card_type,
      acquiredAt: new Date(c.acquired_at).toISOString(),
    })),
    quiz: await getQuizStatus(code, me),
    serverNow: new Date().toISOString(),
    pushDevices: await pushDeviceCount(me),
  };
}

export type DrawResult =
  | { ok: true; capsule: { grade: Grade; amount: number; minutes: number } }
  | { ok: false; reason: "no_ticket" | "empty" | "not_member" | "busy" };

/**
 * 뽑기권 1장을 쓰고 남은 캡슐 중 다음 것을 연다.
 * 캡슐 차지 + 뽑기권 차감 + 금액·시간 누적을 한 문장으로 처리해 동시에 눌러도 꼬이지 않게 한다.
 */
export async function drawCapsule(code: string, kakaoId: string): Promise<DrawResult> {
  const sql = getSql();
  const rows = (await sql`
    with pick as (
      select slot from capsules
      where game_code = ${code} and drawn_by is null
        and exists (
          select 1 from game_players
          where game_code = ${code} and kakao_id = ${kakaoId} and tickets > 0
        )
        and (
          select count(*) from capsules mine
          where mine.game_code = ${code} and mine.drawn_by = ${kakaoId}
        ) < ${MAX_DRAWS_PER_PLAYER}
      order by slot
      limit 1
      for update skip locked
    ), c as (
      update capsules set drawn_by = ${kakaoId}, drawn_at = now()
      from pick
      where capsules.game_code = ${code} and capsules.slot = pick.slot
      returning capsules.grade, capsules.amount, capsules.minutes
    ), p as (
      update game_players gp
      set tickets = gp.tickets - 1,
          money = gp.money + c.amount,
          minutes = gp.minutes + c.minutes
      from c
      where gp.game_code = ${code} and gp.kakao_id = ${kakaoId}
      returning gp.kakao_id
    )
    select c.grade, c.amount, c.minutes from c, p
  `) as { grade: Grade; amount: number; minutes: number }[];

  if (rows.length > 0) return { ok: true, capsule: rows[0] };

  // 왜 못 뽑았는지 알려 준다
  const me = (await sql`
    select tickets from game_players where game_code = ${code} and kakao_id = ${kakaoId}
  `) as { tickets: number }[];
  if (me.length === 0) return { ok: false, reason: "not_member" };
  if (me[0].tickets <= 0) return { ok: false, reason: "no_ticket" };
  const left = (await sql`
    select count(*)::int as n from capsules where game_code = ${code} and drawn_by is null
  `) as { n: number }[];
  if (left[0].n === 0) return { ok: false, reason: "empty" };
  return { ok: false, reason: "busy" };
}

/** 내가 참가한 방 목록 (최근 순) */
export async function listMyGames(kakaoId: string) {
  const sql = getSql();
  return (await sql`
    select g.code, g.created_at,
           (select count(*)::int from game_players x where x.game_code = g.code) as players
    from games g
    join game_players gp on gp.game_code = g.code and gp.kakao_id = ${kakaoId}
    order by g.created_at desc
    limit 10
  `) as { code: string; created_at: string; players: number }[];
}
