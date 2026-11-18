import { ONLINE_WITHIN_S } from "@/lib/birthday-gacha/rules";
import { pickTargetSubscription } from "@/lib/birthday-gacha/push-target";

// 관리자 판별과 알림 현황 계산. DB 없이 테스트할 수 있게 순수 함수로 둔다.

/** ADMIN_KAKAO_IDS="111,222" 형태를 목록으로 */
export function parseAdminIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function adminIds() {
  return parseAdminIds(process.env.ADMIN_KAKAO_IDS);
}

export function isAdmin(kakaoId: string | null | undefined, admins: string[]): boolean {
  return !!kakaoId && admins.includes(kakaoId);
}

export type AdminAccess = "login" | "forbidden" | "ok";

export function adminAccess(kakaoId: string | null | undefined, admins: string[]): AdminAccess {
  if (!kakaoId) return "login";
  return isAdmin(kakaoId, admins) ? "ok" : "forbidden";
}

export function deviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return "알 수 없음";
  if (/iPhone|iPad|iPod/.test(userAgent)) return "아이폰";
  if (/Android/.test(userAgent)) return "안드로이드";
  return "PC";
}

/** 구간이 열린 뒤 이 시간이 지나도 알림이 안 갔으면 누락으로 본다 */
export const MISSED_AFTER_MS = 10 * 60 * 1000;

export type PlayerStatusRow = {
  kakaoId: string;
  nickname: string | null;
  online: boolean;
  lastSeenAt: string | null;
  devices: number;
  deviceLabels: string[];
  pushOn: boolean;
  /** 알림이 실제로 가는 기기 (마지막으로 접속한 기기) */
  targetDevice: string | null;
  lastNotifiedAt: string | null;
  notifiedThisWindow: boolean;
  answeredThisWindow: boolean;
  warning: "알림 꺼짐" | "이번 알림 누락" | null;
};

export function buildPlayerStatus(input: {
  players: { kakaoId: string; nickname: string | null; lastSeenAt: string | null }[];
  subscriptions: { kakaoId: string; endpoint: string; userAgent: string | null; lastSeenAt: string; createdAt: string }[];
  notifications: { kakaoId: string; windowStart: string; sentAt: string }[];
  answeredThisWindow: Set<string>;
  windowStart: string;
  now: number;
}): PlayerStatusRow[] {
  const windowStartMs = new Date(input.windowStart).getTime();

  return input.players.map((p) => {
    const subs = input.subscriptions.filter((s) => s.kakaoId === p.kakaoId);
    const mine = input.notifications
      .filter((n) => n.kakaoId === p.kakaoId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const notifiedThisWindow = mine.some((n) => new Date(n.windowStart).getTime() === windowStartMs);
    const answered = input.answeredThisWindow.has(p.kakaoId);
    const pushOn = subs.length > 0;

    let warning: PlayerStatusRow["warning"] = null;
    if (!pushOn) warning = "알림 꺼짐";
    else if (!notifiedThisWindow && !answered && input.now - windowStartMs >= MISSED_AFTER_MS) {
      warning = "이번 알림 누락";
    }

    return {
      kakaoId: p.kakaoId,
      nickname: p.nickname,
      online: !!p.lastSeenAt && input.now - new Date(p.lastSeenAt).getTime() < ONLINE_WITHIN_S * 1000,
      lastSeenAt: p.lastSeenAt,
      devices: subs.length,
      deviceLabels: subs.map((s) => deviceLabel(s.userAgent)),
      pushOn,
      targetDevice: pushOn ? deviceLabel(pickTargetSubscription(subs)?.userAgent) : null,
      lastNotifiedAt: mine[0]?.sentAt ?? null,
      notifiedThisWindow,
      answeredThisWindow: answered,
      warning,
    };
  });
}
