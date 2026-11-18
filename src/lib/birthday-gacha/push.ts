import { sendNotification, setVapidDetails } from "web-push";
import { getSql } from "@/lib/db";
import { orderByRecency } from "@/lib/birthday-gacha/push-target";

// 웹 푸시. 휴대폰은 사이트를 홈 화면에 추가해야 받을 수 있다 (아이폰 iOS 16.4 이상).

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured = false;
function setup() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:birthday-gacha@example.com", pub, priv);
  configured = true;
  return true;
}

export type SubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function saveSubscription(kakaoId: string, sub: SubscriptionInput, userAgent: string | null) {
  const sql = getSql();
  await sql`
    insert into push_subscriptions (endpoint, kakao_id, p256dh, auth, user_agent)
    values (${sub.endpoint}, ${kakaoId}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${userAgent})
    on conflict (endpoint) do update set
      kakao_id = excluded.kakao_id, p256dh = excluded.p256dh, auth = excluded.auth,
      user_agent = excluded.user_agent, last_seen_at = now()
  `;
}

export async function deleteSubscription(kakaoId: string, endpoint: string) {
  const sql = getSql();
  await sql`delete from push_subscriptions where kakao_id = ${kakaoId} and endpoint = ${endpoint}`;
}

export async function pushDeviceCount(kakaoId: string) {
  const sql = getSql();
  const rows = (await sql`
    select count(*)::int as n from push_subscriptions where kakao_id = ${kakaoId}
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

/** 그 사람이 마지막으로 접속한 기기 한 대로 보낸다. 만료된 구독은 지운다. 성공한 기기 수(0/1)를 돌려준다. */
export async function sendPush(kakaoId: string, payload: PushPayload): Promise<number> {
  if (!setup()) {
    console.error("[push] VAPID 키가 없어 보낼 수 없어요");
    return 0;
  }
  const sql = getSql();
  const all = (await sql`
    select endpoint, p256dh, auth, last_seen_at, created_at from push_subscriptions where kakao_id = ${kakaoId}
  `) as { endpoint: string; p256dh: string; auth: string; last_seen_at: string; created_at: string }[];
  const ordered = orderByRecency(
    all.map((s) => ({
      ...s,
      lastSeenAt: new Date(s.last_seen_at).toISOString(),
      createdAt: new Date(s.created_at).toISOString(),
    })),
  );

  // 마지막 접속 기기부터 시도하고, 구독이 만료됐으면 지우고 그다음 기기로 넘어간다
  for (const s of ordered) {
    try {
      await sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 2 * 60 * 60, urgency: "high" },
      );
      return 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await sql`delete from push_subscriptions where endpoint = ${s.endpoint}`;
        continue;
      }
      console.error("[push] 보내기 실패", status, error);
      return 0;
    }
  }
  return 0;
}
