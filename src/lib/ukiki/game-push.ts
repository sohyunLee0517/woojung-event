// 방 게임 알림: 새 게임이 열리면 방 멤버 모두에게, 재촉하기는 아직 안 들어온 멤버에게 푸시.
import { getSql } from "@/lib/db";
import { sendPush } from "@/lib/birthday-gacha/push";

type GameRow = { id: number; game_type: keyof typeof LABEL; ref_code: string | null; room_name: string };

const LABEL = { fanfare: "🌡️ 우정의 온도", gacha: "🎰 생일 가챠", pirate: "🏴‍☠️ 해적 무찌르기", snack: "🍪 과자 나눠먹기" } as const;

function gameUrl(code: string, g: GameRow) {
  if (g.game_type === "gacha") return `/birthday-gacha/g/${g.ref_code}`;
  return `/r/${code}/${g.game_type}/${g.id}`;
}

async function nickname(kakaoId: string) {
  const sql = getSql();
  const rows = (await sql`select nickname from players where kakao_id = ${kakaoId}`) as { nickname: string | null }[];
  return rows[0]?.nickname ?? "친구";
}

/** game 은 uk_room_games.id 또는 가챠 코드(ref_code) */
async function activeGame(code: string, game: number | string): Promise<GameRow | null> {
  const sql = getSql();
  const byId = typeof game === "number" ? game : null;
  const byRef = typeof game === "string" ? game : null;
  const rows = (await sql`
    select g.id::int as id, g.game_type, g.ref_code, r.name as room_name
    from uk_room_games g join uk_rooms r on r.code = g.room_code
    where g.room_code = ${code} and g.status = 'active'
      and (g.id = ${byId} or g.ref_code = ${byRef})
  `) as GameRow[];
  return rows[0] ?? null;
}

async function sendAll(to: string[], payload: { title: string; body: string; url: string; tag: string }) {
  const results = await Promise.all(to.map((k) => sendPush(k, payload).catch(() => 0)));
  return results.filter((n) => n > 0).length;
}

/** 새 게임이 열렸어요 → 연 사람 빼고 방 멤버 모두. 받은 사람 수를 돌려준다. */
export async function notifyNewGame(code: string, game: number | string, opener: string) {
  const g = await activeGame(code, game);
  if (!g) return 0;
  const sql = getSql();
  const to = (await sql`
    select kakao_id from uk_room_members where room_code = ${code} and kakao_id <> ${opener}
  `) as { kakao_id: string }[];
  const who = await nickname(opener);
  return sendAll(
    to.map((r) => r.kakao_id),
    {
      title: `${LABEL[g.game_type]} · ${g.room_name}`,
      body: `${who}님이 새 게임을 열었어요. 같이 해요!`,
      url: gameUrl(code, g),
      tag: `game-${g.id}`,
    },
  );
}

export type NudgeResult = { ok: true; sent: number } | { ok: false; reason: "not_member" | "not_active" | "cooldown" };

/** 재촉하기: 아직 게임에 안 들어온 방 멤버에게. 같은 게임은 1분에 한 번만. */
export async function nudgeGame(code: string, game: number | string, me: string): Promise<NudgeResult> {
  const sql = getSql();
  const member = (await sql`
    select 1 from uk_room_members where room_code = ${code} and kakao_id = ${me}
  `) as unknown[];
  if (member.length === 0) return { ok: false, reason: "not_member" };
  const g = await activeGame(code, game);
  if (!g) return { ok: false, reason: "not_active" };

  // 먼저 시각을 찍어서 여럿이 동시에 눌러도 한 번만 간다
  const claimed = (await sql`
    update uk_room_games set last_nudged_at = now()
    where id = ${g.id} and (last_nudged_at is null or last_nudged_at < now() - interval '60 seconds')
    returning id
  `) as unknown[];
  if (claimed.length === 0) return { ok: false, reason: "cooldown" };

  const to = (await sql`
    select m.kakao_id from uk_room_members m
    where m.room_code = ${code} and m.kakao_id <> ${me}
      and not exists (select 1 from uk_game_participants p where p.game_id = ${g.id} and p.kakao_id = m.kakao_id)
      and not exists (select 1 from game_players gp where gp.game_code = ${g.ref_code} and gp.kakao_id = m.kakao_id)
      and not exists (select 1 from uk_pirate_players pp where pp.game_id = ${g.id} and pp.kakao_id = m.kakao_id)
      and not exists (select 1 from uk_snack_players sp where sp.game_id = ${g.id} and sp.kakao_id = m.kakao_id)
  `) as { kakao_id: string }[];
  const who = await nickname(me);
  const sent = await sendAll(
    to.map((r) => r.kakao_id),
    {
      title: `📣 ${who}님이 재촉해요!`,
      body: `${g.room_name}에서 ${LABEL[g.game_type]}이(가) 기다리고 있어요. 얼른 들어와요!`,
      url: gameUrl(code, g),
      tag: `nudge-${g.id}`,
    },
  );
  return { ok: true, sent };
}
