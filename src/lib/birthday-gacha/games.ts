import { COUNTDOWN_MS } from "@/lib/ukiki/ready";
import { randomInt } from "node:crypto";
import { getSql } from "@/lib/db";
import { pushDeviceCount } from "@/lib/birthday-gacha/push";
import {
  CAPSULE_SET,
  MAX_DRAWS_PER_PLAYER,
  MAX_PLAYERS,
  ONLINE_WITHIN_S,
  TICKETS_ON_JOIN,
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
  /** 준비완료 눌렀는지 (3·2·1 시작 전) */
  ready: boolean;
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
  /** 남은 시간 계산용 서버 시각 */
  serverNow: string;
  /** 모두 준비완료가 되어 잡힌 시작 시각 (3·2·1 뒤). 아직이면 null */
  startedAt: string | null;
  /** 이 가챠가 열린 우끼끼 방 코드 (옛날 가챠면 null) */
  roomCode: string | null;
  /** 푸시 알림을 등록한 내 기기 수 */
  pushDevices: number;
};

async function parentRoomCode(code: string): Promise<string | null> {
  const sql = getSql();
  const rows = (await sql`
    select room_code from uk_room_games where game_type = 'gacha' and ref_code = ${code} limit 1
  `) as { room_code: string }[];
  return rows[0]?.room_code ?? null;
}

/** 화면에 내려줄 방 상태. 뽑히지 않은 캡슐의 내용은 포함하지 않는다. */
export async function getGameState(code: string, me: string): Promise<GameState | null> {
  const sql = getSql();
  const game = (await sql`select host_kakao_id, started_at from games where code = ${code}`) as {
    host_kakao_id: string;
    started_at: string | null;
  }[];
  if (game.length === 0) return null;
  const host = game[0].host_kakao_id;

  // 상태를 불러오는 것 자체를 접속 신호로 쓴다
  await sql`
    update game_players set last_seen_at = now()
    where game_code = ${code} and kakao_id = ${me}
  `;

  const players = (await sql`
    select gp.kakao_id, p.nickname, p.profile_image, gp.seat, gp.tickets, gp.money, gp.minutes, gp.ready,
           (now() - gp.last_seen_at) < make_interval(secs => ${ONLINE_WITHIN_S}) as online
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
    ready: boolean;
    online: boolean;
  }[];

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
      ready: p.ready,
    })),
    totalCapsules: capsules.length,
    remainingCapsules: capsules.length - drawn.length,
    drawn,
    serverNow: new Date().toISOString(),
    startedAt: game[0].started_at ? new Date(game[0].started_at).toISOString() : null,
    pushDevices: await pushDeviceCount(me),
    roomCode: await parentRoomCode(code),
  };
}

export type DrawResult =
  | { ok: true; capsule: { grade: Grade; amount: number; minutes: number } }
  | { ok: false; reason: "no_ticket" | "empty" | "not_member" | "busy" | "need_players" | "not_started" };

/**
 * 뽑기권 1장을 쓰고 남은 캡슐 중 다음 것을 연다.
 * DB 함수가 플레이어 줄을 잠근 채 처리해서, 연타하거나 여럿이 동시에 눌러도
 * 캡슐이 두 번 뽑히거나 정해진 횟수를 넘지 않는다. (scripts/schema.sql 의 bg_draw_capsule)
 */
export async function drawCapsule(code: string, kakaoId: string): Promise<DrawResult> {
  const sql = getSql();
  const rows = (await sql`
    select out_grade, out_amount, out_minutes, out_reason
    from bg_draw_capsule(${code}, ${kakaoId}, ${MAX_DRAWS_PER_PLAYER})
  `) as { out_grade: Grade | null; out_amount: number | null; out_minutes: number | null; out_reason: string | null }[];
  const r = rows[0];
  if (r && !r.out_reason && r.out_grade) {
    return { ok: true, capsule: { grade: r.out_grade, amount: Number(r.out_amount), minutes: Number(r.out_minutes) } };
  }
  const reason = (r?.out_reason ?? "busy") as "no_ticket" | "empty" | "not_member" | "busy" | "need_players" | "not_started";
  return { ok: false, reason };
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

/**
 * 준비완료 표시. 자리에 앉은 사람이 2명 이상이고 모두 준비완료면 시작 시각을 지금+3초로 잡는다.
 * 한 번 시작하면 준비를 취소해도 멈추지 않는다.
 */
export async function setGachaReady(code: string, kakaoId: string, ready: boolean) {
  const sql = getSql();
  await sql`update game_players set ready = ${ready} where game_code = ${code} and kakao_id = ${kakaoId}`;
  await sql`
    update games g set started_at = now() + make_interval(secs => ${COUNTDOWN_MS / 1000})
    where g.code = ${code} and g.started_at is null
      and (select count(*) from game_players gp where gp.game_code = g.code) >= 2
      and not exists (select 1 from game_players gp where gp.game_code = g.code and not gp.ready)
  `;
}
