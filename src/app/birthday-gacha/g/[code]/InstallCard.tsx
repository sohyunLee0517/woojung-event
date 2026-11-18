"use client";

import { useEffect, useState, type CSSProperties } from "react";

// 안드로이드·PC 크롬은 설치 창을 바로 띄울 수 있다. 아이폰 Safari 는 그런 기능이 없어 방법을 안내한다.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// 이벤트가 컴포넌트보다 먼저 올 수 있어 모듈이 읽히자마자 받아 둔다
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallCard({
  buttonStyle,
  onNotice,
}: {
  buttonStyle: CSSProperties;
  onNotice: (title: string, extra?: { emoji?: string; sub?: string }) => void;
}) {
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios" | "manual">("hidden");
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const update = () => {
      // 우끼끼 앱 안이거나 이미 홈 화면 앱이면 안내 안 함
      if (isStandalone() || (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView) setMode("hidden");
      else if (deferred) setMode("prompt");
      else if (isIos()) setMode("ios");
      else setMode("manual");
    };
    update();
    listeners.add(update);
    // 설치 조건을 맞추려고 서비스 워커를 미리 등록해 둔다
    navigator.serviceWorker?.register("/birthday-gacha-sw.js", { scope: "/birthday-gacha/" }).catch(() => {});
    return () => {
      listeners.delete(update);
    };
  }, []);

  if (mode === "hidden") return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome === "accepted") {
      onNotice("홈 화면에 추가했어요", { emoji: "📲", sub: "이제 🎂 아이콘으로 열어 주세요" });
      setMode("hidden");
    } else setMode(isIos() ? "ios" : "manual");
  };

  return (
    <div style={{ borderRadius: 14, background: "rgba(254,229,0,.08)", border: "1px solid rgba(254,229,0,.25)", fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <span style={{ fontSize: 18 }}>📲</span>
        <span style={{ flex: 1, opacity: 0.9 }}>홈 화면에 추가하면 앱처럼 열리고 알림도 받아요</span>
        {mode === "prompt" ? (
          <button onClick={install} style={{ ...buttonStyle, background: "#FEE500", color: "#191919" }}>
            추가
          </button>
        ) : (
          <button onClick={() => setShowGuide((v) => !v)} style={buttonStyle}>
            방법
          </button>
        )}
      </div>
      {showGuide && mode === "ios" && (
        <ol style={{ margin: 0, padding: "0 16px 12px 34px", lineHeight: 1.7, opacity: 0.85 }}>
          <li>Safari 아래쪽 공유 버튼(□↑)을 눌러요</li>
          <li>&apos;홈 화면에 추가&apos; → &apos;추가&apos;를 눌러요</li>
          <li>홈 화면의 🎂 생일 가챠로 열고 로그인해요</li>
          <li>방에 들어와 알림 &apos;켜기&apos;를 눌러요</li>
        </ol>
      )}
      {showGuide && mode === "manual" && (
        <ol style={{ margin: 0, padding: "0 16px 12px 34px", lineHeight: 1.7, opacity: 0.85 }}>
          <li>브라우저 메뉴(⋮)를 눌러요</li>
          <li>&apos;홈 화면에 추가&apos; 또는 &apos;앱 설치&apos;를 눌러요</li>
          <li>카톡 안에서 열었다면 먼저 &apos;다른 브라우저로 열기&apos;를 해 주세요</li>
        </ol>
      )}
    </div>
  );
}
