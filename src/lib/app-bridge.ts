// 우끼끼 안드로이드 앱(웹뷰) 안에서 열렸는지, 앱이 넣어 준 정보(푸시 토큰 등)를 읽는다.
export type AppInfo = { platform: string; pushToken: string | null; nativeLogin: boolean };

type MaybeWindow = { ReactNativeWebView?: { injectedObjectJson?: () => string } } | undefined;

export function parseAppInfo(w: MaybeWindow): AppInfo | null {
  const raw = w?.ReactNativeWebView?.injectedObjectJson?.();
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { app?: string; platform?: string; pushToken?: string | null; nativeLogin?: boolean };
    if (v.app !== "ukiki") return null;
    return { platform: v.platform ?? "android", pushToken: v.pushToken ?? null, nativeLogin: v.nativeLogin === true };
  } catch {
    return null;
  }
}

export function appInfo(): AppInfo | null {
  if (typeof window === "undefined") return null;
  return parseAppInfo(window as unknown as MaybeWindow);
}

// ── 앱으로 보내는 메시지 ─────────────────────────────
//   { type: "kakaoLogin" }               카카오톡 앱으로 로그인해 줘 → 앱이 window.__ukikiKakao({accessToken}|{error}) 호출
//   { type: "locationToken", token }     백그라운드 위치를 보낼 때 쓸 토큰
//   { type: "logout" }                   로그아웃: 앱이 위치 보내기를 멈추고 토큰을 지운다
export type AppMessage = { type: "kakaoLogin" } | { type: "locationToken"; token: string } | { type: "logout" };

type BridgeWindow = { ReactNativeWebView?: { postMessage?: (m: string) => void } } & Record<string, unknown>;

function bridgeWindow(w?: unknown): BridgeWindow | undefined {
  if (w) return w as BridgeWindow;
  return typeof window === "undefined" ? undefined : (window as unknown as BridgeWindow);
}

export function postToApp(msg: AppMessage, w?: unknown): boolean {
  const rn = bridgeWindow(w)?.ReactNativeWebView;
  if (!rn?.postMessage) return false;
  // 안드로이드 웹뷰의 postMessage 는 떼어 내서 부르면 'Illegal invocation' 으로 조용히 실패한다 → 객체에 붙여 부른다
  rn.postMessage(JSON.stringify(msg));
  return true;
}

export type NativeKakaoResult = { accessToken: string } | { error: string };

export function requestNativeKakaoLogin(w?: unknown): Promise<NativeKakaoResult> {
  const bw = bridgeWindow(w);
  return new Promise((resolve) => {
    if (!bw) return resolve({ error: "no_app" });
    bw.__ukikiKakao = (r: NativeKakaoResult) => {
      delete bw.__ukikiKakao;
      resolve(r);
    };
    if (!postToApp({ type: "kakaoLogin" }, bw)) resolve({ error: "no_app" });
  });
}
