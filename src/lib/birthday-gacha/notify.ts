import { sendPush } from "@/lib/birthday-gacha/push";

function gamePath(code: string) {
  return `/birthday-gacha/g/${code}`;
}

/** 알림이 잘 오는지 내 기기로 한 번 보내 본다. */
export function sendTestPush(kakaoId: string, code: string, url?: string) {
  return sendPush(kakaoId, {
    title: "🐵 우끼끼 알림 테스트",
    body: "이 알림이 보이면 새 게임·재촉 알림도 받을 수 있어요!",
    url: url && url.startsWith("/") && !url.startsWith("//") ? url : gamePath(code),
    tag: "test",
  });
}
