"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { appInfo, requestNativeKakaoLogin } from "@/lib/app-bridge";
import { primaryButton } from "./styles";

/**
 * 카카오로 입장하기.
 *   우끼끼 앱(2.0~): 카카오톡 앱으로 로그인 → 토큰을 서버가 카카오에 확인
 *   그 밖(웹·예전 앱): 지금처럼 카카오 웹 로그인
 */
export default function KakaoLoginButton({ next, webLogin }: { next: string; webLogin: () => Promise<void> }) {
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setNative(appInfo()?.nativeLogin === true), []);

  if (!native) {
    return (
      <form action={webLogin} style={{ display: "flex" }}>
        <button type="submit" style={{ ...primaryButton, flex: 1 }}>
          카카오로 입장하기
        </button>
      </form>
    );
  }

  const login = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await requestNativeKakaoLogin();
    if ("error" in r) {
      setBusy(false);
      if (r.error !== "cancel") setError("카카오 로그인에 실패했어요. 다시 눌러 주세요.");
      return;
    }
    const res = await signIn("kakao-native", { accessToken: r.accessToken, redirect: false });
    if (res?.error) {
      setBusy(false);
      setError(`카카오 로그인을 확인하지 못했어요. 다시 눌러 주세요. (${res.code ?? res.error})`);
      return;
    }
    location.href = next;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button onClick={login} disabled={busy} style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }}>
        {busy ? "로그인 중…" : "카카오로 입장하기"}
      </button>
      {error && <p style={{ fontSize: 13, color: "#f97316", textAlign: "center" }}>{error}</p>}
    </div>
  );
}
