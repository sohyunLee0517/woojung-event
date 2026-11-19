// 우끼끼 안드로이드 앱(APK) 받기 안내. 기기에 따라 보여 줄 내용을 정한다.

/** GitHub 릴리스의 최신 APK (새 버전을 올리면 주소는 그대로) */
export const APK_URL = "https://github.com/sohyunLee0517/woojung-event/releases/latest/download/ukiki.apk";

export type Platform = "android" | "ios" | "app" | "other";

export function detectPlatform(ua: string | null | undefined): Platform {
  if (!ua) return "other";
  if (/UkikiApp\//.test(ua)) return "app";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export type DownloadPlan = {
  kind: "apk" | "ios_home" | "open_on_phone" | "already";
  /** 카톡 같은 앱 안 브라우저면 다운로드가 막힐 수 있다 */
  warnInApp: boolean;
};

export function downloadPlan(ua: string | null | undefined): DownloadPlan {
  const platform = detectPlatform(ua);
  const inAppBrowser = !!ua && /KAKAOTALK|FBAN|FBAV|Instagram|NAVER\(inapp|Line\//i.test(ua);
  if (platform === "app") return { kind: "already", warnInApp: false };
  if (platform === "android") return { kind: "apk", warnInApp: inAppBrowser };
  if (platform === "ios") return { kind: "ios_home", warnInApp: false };
  return { kind: "open_on_phone", warnInApp: false };
}
