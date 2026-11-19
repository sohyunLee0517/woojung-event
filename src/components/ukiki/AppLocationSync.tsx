"use client";

import { useEffect } from "react";
import { appInfo, postToApp } from "@/lib/app-bridge";

/** 우끼끼 앱 안이면, 앱이 꺼져 있을 때도 위치를 보낼 수 있게 위치 토큰을 앱에 건넨다 */
export default function AppLocationSync() {
  useEffect(() => {
    if (!appInfo()) return;
    fetch("/api/ukiki/app/location-token", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { token?: string } | null) => d?.token && postToApp({ type: "locationToken", token: d.token }))
      .catch(() => {});
  }, []);
  return null;
}
