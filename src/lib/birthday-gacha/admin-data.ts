import { getSql } from "@/lib/db";
import { buildPlayerStatus } from "@/lib/birthday-gacha/admin";
import { quizWindow, quizWindowLabel } from "@/lib/birthday-gacha/rules";

/** 관리자 화면용: 최근 14일 방에 들어온 사람들의 알림 현황 */
export async function getAdminOverview(now = Date.now()) {
  const sql = getSql();
  const win = quizWindow(now);
  const windowStart = new Date(win.start).toISOString();

  const players = (await sql`
    select p.kakao_id, p.nickname, max(gp.last_seen_at) as last_seen_at,
           array_agg(distinct gp.game_code) as games
    from game_players gp
    join games g on g.code = gp.game_code
    join players p on p.kakao_id = gp.kakao_id
    where g.created_at > now() - interval '14 days'
    group by p.kakao_id, p.nickname
    order by p.nickname
  `) as { kakao_id: string; nickname: string | null; last_seen_at: string | null; games: string[] }[];
  const ids = players.map((p) => p.kakao_id);

  const subs = (await sql`
    select kakao_id, endpoint, user_agent, last_seen_at, created_at from push_subscriptions where kakao_id = any(${ids})
  `) as { kakao_id: string; endpoint: string; user_agent: string | null; last_seen_at: string; created_at: string }[];
  const notifications = (await sql`
    select kakao_id, window_start, sent_at from push_notifications
    where kakao_id = any(${ids}) and sent_at > now() - interval '7 days'
  `) as { kakao_id: string; window_start: string; sent_at: string }[];
  const answered = (await sql`
    select distinct kakao_id from quiz_attempts
    where kakao_id = any(${ids}) and window_start = ${windowStart} and answered_at is not null
  `) as { kakao_id: string }[];

  const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);
  const rows = buildPlayerStatus({
    players: players.map((p) => ({ kakaoId: p.kakao_id, nickname: p.nickname, lastSeenAt: iso(p.last_seen_at) })),
    subscriptions: subs.map((s) => ({
      kakaoId: s.kakao_id,
      endpoint: s.endpoint,
      userAgent: s.user_agent,
      lastSeenAt: new Date(s.last_seen_at).toISOString(),
      createdAt: new Date(s.created_at).toISOString(),
    })),
    notifications: notifications.map((n) => ({
      kakaoId: n.kakao_id,
      windowStart: new Date(n.window_start).toISOString(),
      sentAt: new Date(n.sent_at).toISOString(),
    })),
    answeredThisWindow: new Set(answered.map((a) => a.kakao_id)),
    windowStart,
    now,
  });
  const gamesOf = new Map(players.map((p) => [p.kakao_id, p.games]));

  return {
    windowLabel: quizWindowLabel(win.start),
    windowStart,
    rows: rows.map((r) => ({ ...r, games: gamesOf.get(r.kakaoId) ?? [] })),
  };
}
