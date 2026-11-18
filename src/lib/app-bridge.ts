// 우끼끼 안드로이드 앱(웹뷰) 안에서 열렸는지, 앱이 넣어 준 정보(푸시 토큰 등)를 읽는다.
export type AppInfo = { platform: string; pushToken: string | null };

type MaybeWindow = { ReactNativeWebView?: { injectedObjectJson?: () => string } } | undefined;

export function parseAppInfo(w: MaybeWindow): AppInfo | null {
  const raw = w?.ReactNativeWebView?.injectedObjectJson?.();
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { app?: string; platform?: string; pushToken?: string | null };
    if (v.app !== "ukiki") return null;
    return { platform: v.platform ?? "android", pushToken: v.pushToken ?? null };
  } catch {
    return null;
  }
}

export function appInfo(): AppInfo | null {
  if (typeof window === "undefined") return null;
  return parseAppInfo(window as unknown as MaybeWindow);
}
