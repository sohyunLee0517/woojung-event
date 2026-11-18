import { randomInt } from "node:crypto";
import { getSql } from "@/lib/db";
import { createGame } from "@/lib/birthday-gacha/games";
import { likePattern, pageResult, parseRoomQuery, type RoomQuery } from "@/lib/ukiki/room-list";
import { gachaRanking, type GachaRank } from "@/lib/ukiki/results";
import {
  fanfareCreateOutcome,
  hashRoomPassword,
  roomEntry,
  validateRoomInput,
  type ActiveFanfare,
  type FanfareCreateOutcome,
  type GameType,
  type RoomEntry,
  type Visibility,
} from "@/lib/ukiki/rules";

// 헷갈리는 글자(0/O, 1/I/L)는 뺀 방 코드
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
}

export function normalizeRoomCode(code: string) {
  return code.trim().toUpperCase();
}

export type RoomSummary = {
  code: string;
  name: string;
  visibility: Visibility;
  ownerName: string | null;
  members: number;
  isMember: boolean;
  activeGames: GameType[];
  createdAt: string;
};

export type RoomGame = {
  id: number;
  type: GameType;
  hostKakaoId: string;
  hostName: string | null;
  refCode: string | null;
  createdAt: string;
};

export type RoomDetail = {
  code: string;
  name: string;
  visibility: Visibility;
  ownerKakaoId: string;
  members: { kakaoId: string; nickname: string | null; image: string | null; online: boolean }[];
  games: RoomGame[];
};

/** 방을 만들고 만든 사람을 멤버로 넣는다 */
export async function createRoom(
  ownerKakaoId: string,
  input: { name: string; visibility: string; password?: string | null },
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const valid = validateRoomInput(input);
  if (!valid.ok) return valid;
  const sql = getSql();
  const hash = valid.value.password ? hashRoomPassword(valid.value.password) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    try {
      await sql.transaction([
        sql`
          insert into uk_rooms (code, name, owner_kakao_id, visibility, password_hash)
          values (${code}, ${valid.value.name}, ${ownerKakaoId}, ${valid.value.visibility}, ${hash})
        `,
        sql`insert into uk_room_members (room_code, kakao_id) values (${code}, ${ownerKakaoId})`,
      ]);
      return { ok: true, code };
    } catch {
      // 방 코드가 겹치면 다시 뽑는다
    }
  }
  return { ok: false, error: "방을 만들지 못했어요. 다시 시도해 주세요" };
}

/** 로비의 방 리스트 (비밀방도 🔒 로 보여 준다). 검색 + 20개씩 더보기 */
export async function listRooms(
  me: string,
  query: RoomQuery = parseRoomQuery({}),
  opts: { mineOnly?: boolean } = {},
) {
  const sql = getSql();
  const pattern = query.q ? likePattern(query.q) : null;
  const mineOnly = !!opts.mineOnly;
  const rows = (await sql`
    select r.code, r.name, r.visibility, r.created_at, p.nickname as owner_name,
           (select count(*)::int from uk_room_members m where m.room_code = r.code) as members,
           exists (select 1 from uk_room_members m where m.room_code = r.code and m.kakao_id = ${me}) as is_member,
           coalesce((select array_agg(distinct g.game_type) from uk_room_games g
                     where g.room_code = r.code and g.status = 'active'
                       and not (g.game_type = 'gacha' and not exists (
                         select 1 from capsules c where c.game_code = g.ref_code and c.drawn_by is null))
                    ), '{}') as active_games
    from uk_rooms r
    join players p on p.kakao_id = r.owner_kakao_id
    where (${pattern}::text is null or r.name ilike ${pattern} escape '\\')
      and (not ${mineOnly} or exists (
        select 1 from uk_room_members m where m.room_code = r.code and m.kakao_id = ${me}))
    order by r.created_at desc, r.code
    limit ${query.limit + 1} offset ${query.offset}
  `) as {
    code: string;
    name: string;
    visibility: Visibility;
    created_at: string;
    owner_name: string | null;
    members: number;
    is_member: boolean;
    active_games: GameType[];
  }[];
  const page = pageResult(rows, query.offset);
  return {
    ...page,
    items: page.items.map(
      (r): RoomSummary => ({
        code: r.code,
        name: r.name,
        visibility: r.visibility,
        ownerName: r.owner_name,
        members: r.members,
        isMember: r.is_member,
        activeGames: r.active_games,
        createdAt: new Date(r.created_at).toISOString(),
      }),
    ),
  };
}

export type RoomPage = Awaited<ReturnType<typeof listRooms>>;

async function loadRoomRow(code: string) {
  const sql = getSql();
  const rows = (await sql`
    select code, name, visibility, owner_kakao_id, password_hash from uk_rooms where code = ${code}
  `) as { code: string; name: string; visibility: Visibility; owner_kakao_id: string; password_hash: string | null }[];
  return rows[0] ?? null;
}

async function isRoomMember(code: string, kakaoId: string) {
  const sql = getSql();
  const rows = (await sql`
    select 1 from uk_room_members where room_code = ${code} and kakao_id = ${kakaoId}
  `) as unknown[];
  return rows.length > 0;
}

/**
 * 방에 들어간다. 공개방은 바로 멤버가 되고, 비밀방은 비밀번호가 맞아야 멤버가 된다.
 * password 를 안 넘기면 비밀방에서는 need_password 를 돌려준다.
 */
export async function enterRoom(
  code: string,
  me: string,
  password?: string,
): Promise<RoomEntry | "not_found"> {
  const room = await loadRoomRow(code);
  if (!room) return "not_found";
  const result = roomEntry({
    visibility: room.visibility,
    passwordHash: room.password_hash,
    isMember: await isRoomMember(code, me),
    password,
  });
  if (result === "enter") {
    const sql = getSql();
    await sql`
      insert into uk_room_members (room_code, kakao_id) values (${code}, ${me})
      on conflict (room_code, kakao_id) do update set last_seen_at = now()
    `;
  }
  return result;
}

/** 방 화면용 상세 (멤버만 볼 수 있다) */
export async function getRoomDetail(code: string, me: string): Promise<RoomDetail | null> {
  const room = await loadRoomRow(code);
  if (!room || !(await isRoomMember(code, me))) return null;
  const sql = getSql();
  const members = (await sql`
    select m.kakao_id, p.nickname, p.profile_image,
           (now() - m.last_seen_at) < interval '30 seconds' as online
    from uk_room_members m join players p on p.kakao_id = m.kakao_id
    where m.room_code = ${code}
    order by m.joined_at
  `) as { kakao_id: string; nickname: string | null; profile_image: string | null; online: boolean }[];
  const games = (await sql`
    select g.id, g.game_type, g.host_kakao_id, p.nickname as host_name, g.ref_code, g.created_at
    from uk_room_games g join players p on p.kakao_id = g.host_kakao_id
    where g.room_code = ${code} and g.status = 'active'
      and not (g.game_type = 'gacha' and not exists (
        select 1 from capsules c where c.game_code = g.ref_code and c.drawn_by is null))
    order by g.created_at desc
  `) as {
    id: number;
    game_type: GameType;
    host_kakao_id: string;
    host_name: string | null;
    ref_code: string | null;
    created_at: string;
  }[];
  return {
    code: room.code,
    name: room.name,
    visibility: room.visibility,
    ownerKakaoId: room.owner_kakao_id,
    members: members.map((m) => ({
      kakaoId: m.kakao_id,
      nickname: m.nickname,
      image: m.profile_image,
      online: m.online,
    })),
    games: games.map((g) => ({
      id: Number(g.id),
      type: g.game_type,
      hostKakaoId: g.host_kakao_id,
      hostName: g.host_name,
      refCode: g.ref_code,
      createdAt: new Date(g.created_at).toISOString(),
    })),
  };
}

export async function touchRoomMember(code: string, me: string) {
  const sql = getSql();
  await sql`update uk_room_members set last_seen_at = now() where room_code = ${code} and kakao_id = ${me}`;
}

async function activeFanfare(code: string): Promise<ActiveFanfare | null> {
  const sql = getSql();
  const rows = (await sql`
    select g.id, g.host_kakao_id, p.nickname
    from uk_room_games g join players p on p.kakao_id = g.host_kakao_id
    where g.room_code = ${code} and g.game_type = 'fanfare' and g.status = 'active'
    limit 1
  `) as { id: number; host_kakao_id: string; nickname: string | null }[];
  return rows[0] ? { id: Number(rows[0].id), hostKakaoId: rows[0].host_kakao_id, hostName: rows[0].nickname } : null;
}

/**
 * 빵빠레를 연다. 만든 사람이 호스트(카메라).
 * 방에 진행 중인 빵빠레가 이미 있으면(동시에 만든 경우 포함) conflict 를 돌려준다.
 */
export async function createFanfare(
  code: string,
  me: string,
): Promise<FanfareCreateOutcome | { kind: "not_member" }> {
  if (!(await isRoomMember(code, me))) return { kind: "not_member" };
  const sql = getSql();
  const inserted = (await sql`
    insert into uk_room_games (room_code, game_type, host_kakao_id)
    values (${code}, 'fanfare', ${me})
    on conflict do nothing
    returning id
  `) as { id: number }[];
  const createdId = inserted[0] ? Number(inserted[0].id) : null;
  if (createdId !== null) await joinFanfare(code, createdId, me);
  return fanfareCreateOutcome({ createdId, active: createdId === null ? await activeFanfare(code) : null });
}

/**
 * 빵빠레 끝내기 (호스트만).
 *   completed: 공개까지 마침 · aborted: 진행 중 중단(기록에 '중단') · cancelled: 시작 전 닫기(기록 안 남음)
 */
export async function endFanfare(
  code: string,
  id: number,
  me: string,
  outcome: "completed" | "aborted" | "cancelled" = "completed",
) {
  const sql = getSql();
  const rows = (await sql`
    update uk_room_games set status = 'ended', ended_at = now(), outcome = ${outcome}
    where id = ${id} and room_code = ${code} and game_type = 'fanfare' and status = 'active'
      and host_kakao_id = ${me}
    returning id
  `) as unknown[];
  return rows.length > 0;
}

export async function getRoomGame(code: string, id: number) {
  const sql = getSql();
  const rows = (await sql`
    select g.id, g.game_type, g.host_kakao_id, p.nickname as host_name, g.status, g.ref_code
    from uk_room_games g join players p on p.kakao_id = g.host_kakao_id
    where g.room_code = ${code} and g.id = ${id}
  `) as {
    id: number;
    game_type: GameType;
    host_kakao_id: string;
    host_name: string | null;
    status: "active" | "ended";
    ref_code: string | null;
  }[];
  return rows[0] ?? null;
}

/** 방 안에서 생일 가챠 한 판을 연다. 기존 가챠 게임을 만들고 방에 연결한다. */
export async function createGachaInRoom(code: string, me: string): Promise<string | null> {
  if (!(await isRoomMember(code, me))) return null;
  const gachaCode = await createGame(me);
  const sql = getSql();
  await sql`
    insert into uk_room_games (room_code, game_type, host_kakao_id, ref_code)
    values (${code}, 'gacha', ${me}, ${gachaCode})
  `;
  return gachaCode;
}

/** 빵빠레 화면에 들어온 사람을 참여자로 기록한다 (여러 번 들어와도 한 번) */
export async function joinFanfare(code: string, id: number, me: string) {
  const sql = getSql();
  await sql`
    insert into uk_game_participants (game_id, kakao_id)
    select g.id, ${me} from uk_room_games g
    where g.id = ${id} and g.room_code = ${code} and g.game_type = 'fanfare'
      and exists (select 1 from uk_room_members m where m.room_code = ${code} and m.kakao_id = ${me})
    on conflict do nothing
  `;
}

export type PastGame = {
  id: number;
  type: GameType;
  hostKakaoId: string;
  hostName: string | null;
  refCode: string | null;
  startedAt: string;
  endedAt: string;
  participants: { kakaoId: string; nickname: string | null; image: string | null }[];
  gachaResult: GachaRank[] | null;
  /** 완료 / 중단 (가챠는 항상 완료) */
  outcome: "completed" | "aborted";
  /** 빵빠레 탭 순위 (결과를 저장한 경우) */
  fanfareResult: { kakaoId: string; nickname: string | null; taps: number; rank: number }[] | null;
};

/**
 * 방의 지난 게임 (끝난 빵빠레 + 캡슐을 다 뽑은 가챠). 최근 끝난 순, 20개씩 더보기.
 * 방 멤버면 누구나 (나중에 들어온 사람도) 전부 볼 수 있다. 멤버가 아니면 null.
 */
export async function listPastGames(code: string, me: string, offset = 0) {
  if (!(await isRoomMember(code, me))) return null;
  const { offset: safeOffset, limit } = parseRoomQuery({ offset: String(offset) });
  const sql = getSql();
  const rows = (await sql`
    with g as (
      select g.id, g.game_type, g.host_kakao_id, g.ref_code, g.created_at, g.outcome,
             case when g.game_type = 'gacha'
                  then (select max(c.drawn_at) from capsules c where c.game_code = g.ref_code)
                  else g.ended_at end as ended_at
      from uk_room_games g
      where g.room_code = ${code}
        and (
          (g.game_type = 'fanfare' and g.status = 'ended' and coalesce(g.outcome, 'completed') <> 'cancelled')
          or (g.game_type = 'gacha'
              and exists (select 1 from capsules c where c.game_code = g.ref_code)
              and not exists (select 1 from capsules c where c.game_code = g.ref_code and c.drawn_by is null))
        )
    )
    select g.*, p.nickname as host_name from g join players p on p.kakao_id = g.host_kakao_id
    order by g.ended_at desc nulls last, g.id desc
    limit ${limit + 1} offset ${safeOffset}
  `) as {
    id: number;
    game_type: GameType;
    host_kakao_id: string;
    ref_code: string | null;
    created_at: string;
    ended_at: string | null;
    host_name: string | null;
    outcome: string | null;
  }[];
  const page = pageResult(rows, safeOffset);
  const ids = page.items.map((r) => Number(r.id));
  const gachaCodes = page.items.filter((r) => r.game_type === "gacha" && r.ref_code).map((r) => r.ref_code as string);

  const fanfareParts = (await sql`
    select gp.game_id, gp.kakao_id, p.nickname, p.profile_image, gp.taps
    from uk_game_participants gp join players p on p.kakao_id = gp.kakao_id
    where gp.game_id = any(${ids})
    order by gp.joined_at
  `) as { game_id: number; kakao_id: string; nickname: string | null; profile_image: string | null; taps: number | null }[];
  const gachaPlayers = (await sql`
    select gp.game_code, gp.kakao_id, p.nickname, p.profile_image, gp.money, gp.minutes
    from game_players gp join players p on p.kakao_id = gp.kakao_id
    where gp.game_code = any(${gachaCodes})
    order by gp.seat
  `) as {
    game_code: string;
    kakao_id: string;
    nickname: string | null;
    profile_image: string | null;
    money: number;
    minutes: number;
  }[];

  const items: PastGame[] = page.items.map((r) => {
    const isGacha = r.game_type === "gacha";
    const gps = gachaPlayers.filter((x) => x.game_code === r.ref_code);
    const parts = isGacha
      ? gps.map((x) => ({ kakaoId: x.kakao_id, nickname: x.nickname, image: x.profile_image }))
      : fanfareParts
          .filter((x) => Number(x.game_id) === Number(r.id))
          .map((x) => ({ kakaoId: x.kakao_id, nickname: x.nickname, image: x.profile_image }));
    return {
      id: Number(r.id),
      type: r.game_type,
      hostKakaoId: r.host_kakao_id,
      hostName: r.host_name,
      refCode: r.ref_code,
      startedAt: new Date(r.created_at).toISOString(),
      endedAt: new Date(r.ended_at ?? r.created_at).toISOString(),
      participants: parts,
      gachaResult: isGacha
        ? gachaRanking(gps.map((x) => ({ kakaoId: x.kakao_id, nickname: x.nickname, money: x.money, minutes: x.minutes })))
        : null,
      outcome: r.outcome === "aborted" ? "aborted" : "completed",
      fanfareResult: isGacha ? null : fanfareRanking(fanfareParts.filter((x) => Number(x.game_id) === Number(r.id))),
    };
  });
  return { items, hasMore: page.hasMore, nextOffset: page.nextOffset };
}

export type LeaveResult = { ok: true; roomDeleted: boolean } | { ok: false; reason: "not_member" };

/** 방 나가기 (scripts/schema.sql 의 uk_leave_room) */
export async function leaveRoom(code: string, me: string): Promise<LeaveResult> {
  const sql = getSql();
  const rows = (await sql`
    select out_ok, out_reason, out_deleted from uk_leave_room(${code}, ${me})
  `) as { out_ok: boolean; out_reason: string | null; out_deleted: boolean }[];
  const r = rows[0];
  if (r?.out_ok) return { ok: true, roomDeleted: r.out_deleted };
  return { ok: false, reason: "not_member" };
}

function fanfareRanking(rows: { kakao_id: string; nickname: string | null; taps: number | null }[]) {
  const scored = rows
    .filter((r) => r.taps !== null)
    .map((r) => ({ kakaoId: r.kakao_id, nickname: r.nickname, taps: Number(r.taps) }))
    .sort((a, b) => b.taps - a.taps);
  if (scored.length === 0) return null;
  return scored.map((r) => ({ ...r, rank: scored.findIndex((x) => x.taps === r.taps) + 1 }));
}

/** 빵빠레 결과(참여자별 탭 수) 저장. 호스트만, 방 멤버의 기록만 받는다. */
export async function saveFanfareResult(code: string, id: number, me: string, taps: Record<string, number>) {
  const sql = getSql();
  const game = (await sql`
    select 1 from uk_room_games
    where id = ${id} and room_code = ${code} and game_type = 'fanfare' and host_kakao_id = ${me}
  `) as unknown[];
  if (game.length === 0) return false;
  const ids = Object.keys(taps);
  const counts = ids.map((k) => Math.max(0, Math.floor(Number(taps[k]) || 0)));
  await sql`
    insert into uk_game_participants (game_id, kakao_id, taps)
    select ${id}, t.kakao_id, t.taps
    from unnest(${ids}::text[], ${counts}::int[]) as t(kakao_id, taps)
    where exists (select 1 from uk_room_members m where m.room_code = ${code} and m.kakao_id = t.kakao_id)
    on conflict (game_id, kakao_id) do update set taps = excluded.taps
  `;
  return true;
}
