// 내 마지막 접속 기기로 테스트 푸시 한 번. 실행: npm run push:test [카카오ID]
// 카카오ID 를 빼면 ADMIN_KAKAO_IDS 의 첫 번째 사람에게 보낸다.
import { getSql } from "@/lib/db";
import { sendPush } from "@/lib/birthday-gacha/push";

const to = process.argv[2] ?? process.env.ADMIN_KAKAO_IDS?.split(",")[0]?.trim();
if (!to) throw new Error("받을 사람이 없어요 (카카오ID 또는 ADMIN_KAKAO_IDS)");

const devices = (await getSql()`
  select endpoint, user_agent, last_seen_at from push_subscriptions where kakao_id = ${to} order by last_seen_at desc
`) as { endpoint: string; user_agent: string | null; last_seen_at: string }[];
console.log(`등록된 기기 ${devices.length}대 (최근 접속 순)`);
for (const d of devices)
  console.log(" -", new Date(d.last_seen_at).toLocaleString("ko-KR"), d.endpoint.startsWith("fcm:") ? "앱" : "웹", (d.user_agent ?? "").slice(0, 60));

const n = await sendPush(to, { title: "🐵 우끼끼 푸시 테스트", body: "이 알림이 보이면 푸시가 잘 오는 거예요!", url: "/", tag: "test" });
console.log(n ? "✅ 마지막 접속 기기로 보냈어요" : "❌ 보낼 수 있는 기기가 없어요");
