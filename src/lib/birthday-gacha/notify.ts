import { getSql } from "@/lib/db";
import { sendPush } from "@/lib/birthday-gacha/push";
import { quizWindow, quizWindowLabel } from "@/lib/birthday-gacha/rules";

function gamePath(code: string) {
  return `/birthday-gacha/g/${code}`;
}

/** 알림이 잘 오는지 내 기기로 한 번 보내 본다. */
export function sendTestPush(kakaoId: string, code: string) {
  return sendPush(kakaoId, {
    title: "🎂 생일 가챠 알림 테스트",
    body: "이 알림이 보이면 퀴즈 알림도 받을 수 있어요!",
    url: gamePath(code),
    tag: "test",
  });
}

/**
 * 새 2시간 구간이 열렸을 때 호출한다.
 * 이번 구간 퀴즈를 아직 안 푼 사람에게 한 번씩만 푸시를 보낸다. (최근 14일 안에 만든 방 기준)
 */
export async function notifyQuizWindow(nowMs = Date.now()) {
  const sql = getSql();
  const win = quizWindow(nowMs);
  const windowStart = new Date(win.start).toISOString();
  const label = quizWindowLabel(win.start);

  // 사람마다 가장 최근에 들어간 방 하나만 고른다
  const targets = (await sql`
    select distinct on (gp.kakao_id) gp.kakao_id, gp.game_code
    from game_players gp
    join games g on g.code = gp.game_code
    where g.created_at > now() - interval '14 days'
      and exists (select 1 from push_subscriptions s where s.kakao_id = gp.kakao_id)
      and not exists (
        select 1 from push_notifications n
        where n.kakao_id = gp.kakao_id and n.window_start = ${windowStart}
      )
      and not exists (
        select 1 from quiz_attempts q
        where q.kakao_id = gp.kakao_id and q.game_code = gp.game_code
          and q.window_start = ${windowStart} and q.answered_at is not null
      )
    order by gp.kakao_id, gp.joined_at desc
  `) as { kakao_id: string; game_code: string }[];

  const results: { kakaoId: string; devices: number }[] = [];
  for (const t of targets) {
    // 먼저 기록해서 동시에 두 번 불려도 한 번만 가게 한다
    const claimed = (await sql`
      insert into push_notifications (kakao_id, window_start) values (${t.kakao_id}, ${windowStart})
      on conflict do nothing returning kakao_id
    `) as unknown[];
    if (claimed.length === 0) continue;

    const devices = await sendPush(t.kakao_id, {
      title: `🃏 ${label} 특수카드 퀴즈 열림!`,
      body: "맞히면 특수카드 1장. 이번 2시간 안에 풀어야 해요 ⏰",
      url: gamePath(t.game_code),
      tag: `quiz-${windowStart}`,
    });
    if (devices === 0) {
      // 한 대도 못 받았으면 다음 호출 때 다시 시도
      await sql`delete from push_notifications where kakao_id = ${t.kakao_id} and window_start = ${windowStart}`;
    }
    results.push({ kakaoId: t.kakao_id, devices });
  }
  return { window: label, notified: results.filter((r) => r.devices > 0).length, results };
}
