"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { isIos, isStandalone } from "./InstallCard";
import { appInfo } from "@/lib/app-bridge";

const SW_URL = "/birthday-gacha-sw.js";
const SW_SCOPE = "/birthday-gacha/";

type Status =
  | "checking"
  | "unsupported" // 이 브라우저는 푸시를 못 받음
  | "need_install" // 아이폰: 홈 화면에 추가해야 받을 수 있음
  | "denied" // 알림을 차단함
  | "off"
  | "on"
  | "app_off" // 앱 안인데 알림 권한이 꺼져 있음
  | "app_ios"; // 아이폰 앱은 아직 푸시를 못 받음 (무료 애플 계정)

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  return reg ? reg.pushManager.getSubscription() : null;
}

export default function PushCard({
  code,
  onNotice,
  buttonStyle,
  onLabel = "퀴즈 알림이 이 기기로 와요 (마지막 접속 기기)",
  offLabel = "퀴즈가 열릴 때 알림 받기",
  testUrl,
}: {
  code: string;
  onLabel?: string;
  offLabel?: string;
  /** 테스트 알림을 눌렀을 때 열 화면 (없으면 가챠 화면) */
  testUrl?: string;
  onNotice: (title: string, extra?: { emoji?: string; sub?: string }) => void;
  buttonStyle: CSSProperties;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    // 우끼끼 앱 안: 앱 푸시 토큰을 등록(=마지막 접속 기기로 갱신)
    const app = appInfo();
    if (app) {
      if (!app.pushToken) return setStatus(app.platform === "ios" ? "app_ios" : "app_off");
      const res = await fetch("/api/birthday-gacha/push/app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: app.pushToken }),
      }).catch(() => null);
      setStatus(res?.ok ? "on" : "app_off");
      return;
    }
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      setStatus(isIos() && !isStandalone() ? "need_install" : "unsupported");
      return;
    }
    if (isIos() && !isStandalone()) return setStatus("need_install");
    if (Notification.permission === "denied") return setStatus("denied");
    const sub = await currentSubscription().catch(() => null);
    const on = !!sub && Notification.permission === "granted";
    setStatus(on ? "on" : "off");
    // 이 기기를 '마지막 접속 기기'로 알려서 알림이 여기로 오게 한다
    if (on && sub) {
      fetch("/api/birthday-gacha/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    // 화면이 뜰 때, 그리고 다른 앱에 갔다가 돌아올 때마다 확인한다
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("no_key");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const res = await fetch("/api/birthday-gacha/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("save_failed");
      setStatus("on");
      onNotice("알림을 켰어요", { emoji: "🔔", sub: "이 기기로 알림이 와요" });
    } catch (error) {
      console.error("[push] 켜기 실패", error);
      onNotice("알림을 켜지 못했어요", { emoji: "⚠️" });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/birthday-gacha/push/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, url: testUrl }),
    }).catch(() => null);
    const data = res ? ((await res.json()) as { ok: boolean; devices: number }) : null;
    setBusy(false);
    if (data?.ok) onNotice("알림을 보냈어요", { emoji: "🔔", sub: `기기 ${data.devices}대` });
    else {
      // 서버에 구독이 없으면 다시 등록한다
      setStatus("off");
      onNotice("이 기기는 등록이 안 돼 있어요", { emoji: "⚠️", sub: "켜기를 다시 눌러 주세요" });
    }
  };

  if (status === "checking") return null;

  const text: Record<Exclude<Status, "checking">, string> = {
    on: onLabel,
    off: offLabel,
    need_install: "아이폰은 홈 화면에 추가한 뒤 알림을 켤 수 있어요",
    denied: "알림이 차단돼 있어요. 설정에서 허용해 주세요",
    unsupported: "이 브라우저는 알림을 받을 수 없어요",
    app_off: "휴대폰 설정 → 앱 → 우끼끼 → 알림을 켜 주세요",
    app_ios: "아이폰 앱은 아직 알림을 받을 수 없어요",
  };

  return (
    <div style={{ borderRadius: 14, background: "rgba(255,255,255,.05)", fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <span style={{ fontSize: 18 }}>{status === "on" ? "🔔" : "🔕"}</span>
        <span style={{ flex: 1, opacity: 0.85 }}>{text[status]}</span>
        {status === "on" && (
          <button onClick={test} disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.5 : 1 }}>
            테스트
          </button>
        )}
        {status === "off" && (
          <button
            onClick={enable}
            disabled={busy}
            style={{ ...buttonStyle, background: "#FEE500", color: "#191919", opacity: busy ? 0.5 : 1 }}
          >
            {busy ? "켜는 중…" : "켜기"}
          </button>
        )}
      </div>
    </div>
  );
}
