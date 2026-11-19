"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ATTACK_RANGE_M,
  LOCATION_POLL_INTERVAL_MS,
  LOCATION_SEND_INTERVAL_MS,
  OUTDOOR_MAX_ACCURACY_M,
  canAttack,
  distanceMeters,
  isOutdoorFix,
} from "@/lib/birthday-gacha/geo";
import type { PlayerLocation } from "@/lib/birthday-gacha/locations";
import { LEGACY } from "@/lib/ukiki/legacy";

type Fix = { lat: number; lng: number; accuracy: number };

const httpsImage = (url: string | null) => url?.replace(/^http:\/\//, "https://") ?? null;

// 카카오 프로필 사진 + 닉네임으로 된 캐릭터 마커
function characterElement(player: PlayerLocation, isMe: boolean) {
  const root = document.createElement("div");
  root.style.cssText =
    "display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);";
  const ring = document.createElement("div");
  ring.style.cssText = `width:44px;height:44px;border-radius:50%;overflow:hidden;background:#333;border:3px solid ${
    isMe ? "#FEE500" : "#fff"
  };box-shadow:0 2px 6px rgba(0,0,0,.5);`;
  const src = httpsImage(player.image);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.style.cssText = "width:100%;height:100%;object-fit:cover;";
    ring.appendChild(img);
  }
  const label = document.createElement("div");
  label.textContent = isMe ? "나" : player.nickname ?? "?";
  label.style.cssText =
    "margin-top:2px;padding:1px 6px;border-radius:8px;background:rgba(0,0,0,.75);color:#fff;font-size:12px;white-space:nowrap;";
  root.append(ring, label);
  return root;
}

// 화면을 열어 둔 사람은 몇 초마다 위치를 보내므로, 최근 갱신이면 '접속 중'으로 본다.
const ONLINE_WITHIN_S = 20;

function secondsAgo(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

export default function MapView({ roomCode, backHref, backLabel }: { roomCode: string; backHref: string; backLabel: string }) {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInApp(!!(window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView);
  }, []);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef(new Map<string, Leaflet.Marker>());
  const iconKeysRef = useRef(new Map<string, string>());
  const accuracyCircleRef = useRef<Leaflet.Circle | null>(null);
  const fittedRef = useRef(false);
  const lastSentRef = useRef(0);

  const [myId, setMyId] = useState<string | null>(null);
  const [myFix, setMyFix] = useState<Fix | null>(null);
  const [players, setPlayers] = useState<PlayerLocation[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [, setTick] = useState(0);

  // 지도 만들기 (Leaflet 은 브라우저에서만 동작하므로 여기서 불러온다)
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapDivRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapDivRef.current, { zoomControl: false }).setView(
        [34.6687, 135.5013], // 처음엔 도톤보리, 내 위치를 받으면 이동
        16,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // 내 위치 추적 + 서버로 전송
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("이 브라우저는 위치를 지원하지 않아요.");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setMyFix(fix);
        setGeoError(null);
        const now = Date.now();
        if (now - lastSentRef.current >= LOCATION_SEND_INTERVAL_MS) {
          lastSentRef.current = now;
          fetch("/api/birthday-gacha/locations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(fix),
          }).catch(() => {});
        }
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 꺼져 있어요. 브라우저 설정에서 위치를 허용해 주세요."
            : "위치를 가져오지 못했어요. 잠시 후 다시 시도해요.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 다른 사람 위치 주기적으로 불러오기
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/birthday-gacha/locations?room=${roomCode}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { me: string; locations: PlayerLocation[] };
        if (stopped) return;
        setMyId(data.me);
        setPlayers(data.locations);
      } catch {
        // 네트워크가 잠깐 끊겨도 다음 주기에 다시 시도
      }
    };
    load();
    const id = setInterval(load, LOCATION_POLL_INTERVAL_MS);
    const tick = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      stopped = true;
      clearInterval(id);
      clearInterval(tick);
    };
  }, []);

  // 마커 갱신
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;

    // 내 위치는 서버 왕복을 기다리지 않고 바로 반영
    const merged = players.map((p) =>
      p.kakaoId === myId && myFix ? { ...p, ...myFix } : p,
    );
    if (myFix && myId && !merged.some((p) => p.kakaoId === myId)) {
      merged.push({
        kakaoId: myId,
        nickname: "나",
        image: null,
        updatedAt: new Date().toISOString(),
        ...myFix,
      });
    }

    const seen = new Set<string>();
    for (const p of merged) {
      seen.add(p.kakaoId);
      const isMe = p.kakaoId === myId;
      const iconKey = `${p.image ?? ""}|${p.nickname ?? ""}`;
      const makeIcon = () =>
        L.divIcon({ html: characterElement(p, isMe), className: "", iconSize: [0, 0] });
      const existing = markersRef.current.get(p.kakaoId);
      if (existing) {
        existing.setLatLng([p.lat, p.lng]);
        // 처음엔 사진 없이 그렸다가 서버에서 프로필이 오면 다시 그린다
        if (iconKeysRef.current.get(p.kakaoId) !== iconKey) existing.setIcon(makeIcon());
      } else {
        const marker = L.marker([p.lat, p.lng], {
          icon: makeIcon(),
          zIndexOffset: isMe ? 1000 : 0,
        });
        marker.addTo(map);
        markersRef.current.set(p.kakaoId, marker);
      }
      iconKeysRef.current.set(p.kakaoId, iconKey);
    }
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        iconKeysRef.current.delete(id);
      }
    }

    if (myFix) {
      const color = isOutdoorFix(myFix.accuracy) ? "#22c55e" : "#f97316";
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([myFix.lat, myFix.lng]);
        accuracyCircleRef.current.setRadius(myFix.accuracy);
        accuracyCircleRef.current.setStyle({ color, fillColor: color });
      } else {
        accuracyCircleRef.current = L.circle([myFix.lat, myFix.lng], {
          radius: myFix.accuracy,
          color,
          fillColor: color,
          fillOpacity: 0.12,
          weight: 1,
        }).addTo(map);
      }
      if (!fittedRef.current) {
        fittedRef.current = true;
        map.setView([myFix.lat, myFix.lng], 17);
      }
    }
  }, [players, myFix, myId, mapReady]);

  const others = players.filter((p) => p.kakaoId !== myId);
  const outdoor = myFix ? isOutdoorFix(myFix.accuracy) : false;

  const stopSharing = async () => {
    await fetch("/api/birthday-gacha/locations", { method: "DELETE" }).catch(() => {});
  };

  return (
    <div style={{ position: "absolute", inset: 0, color: "#fff", fontFamily: "sans-serif" }}>
      <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />

      {/* 웹은 화면을 켜 둔 동안만 위치가 잡힌다 → 앱 안내 (앱 안에서는 숨김) */}
      {!inApp && (
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 12,
          right: 12,
          zIndex: 1000,
          padding: "8px 12px",
          borderRadius: 10,
          background: "rgba(254,229,0,.92)",
          color: "#191919",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ flex: 1 }}>📍 더 정확한 위치(화면을 꺼도 공유)는 우끼끼 앱에서 이용해 주세요</span>
        <a href="/app" style={{ fontWeight: 800, color: "#191919", whiteSpace: "nowrap" }}>
          앱 받기 →
        </a>
      </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          zIndex: 1000,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Link
          href={backHref}
          style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(0,0,0,.75)", color: "#fff" }}
        >
          {backLabel}
        </Link>
        <button
          onClick={stopSharing}
          style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(0,0,0,.75)", color: "#fff", border: "none" }}
        >
          내 위치 지우기
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 1000,
          padding: 14,
          borderRadius: 14,
          background: "rgba(10,10,10,.88)",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {geoError ? (
          <p style={{ color: "#f97316" }}>{geoError}</p>
        ) : !myFix ? (
          <p>내 위치를 찾는 중…</p>
        ) : (
          <p>
            {LEGACY.mapAttack && (outdoor ? "🟢 야외 · " : "🟠 실내 또는 위치 부정확 · ")}내 위치 오차 ±{Math.round(myFix.accuracy)}m
            {LEGACY.mapAttack && !outdoor && (
              <span style={{ opacity: 0.7 }}> (±{OUTDOOR_MAX_ACCURACY_M}m 이하일 때만 공격 가능)</span>
            )}
          </p>
        )}

        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {others.length === 0 && <p style={{ opacity: 0.6 }}>지도에 다른 친구가 아직 없어요.</p>}
          {others.map((p) => {
            const dist = myFix ? distanceMeters(myFix, p) : null;
            const attackable = myFix ? canAttack(myFix, p) : false;
            return (
              <div key={p.kakaoId} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>
                  {secondsAgo(p.updatedAt) <= ONLINE_WITHIN_S ? "🟢 " : "⚪ "}
                  {p.nickname ?? "?"}
                  <span style={{ opacity: 0.6 }}>
                    {" "}
                    · {dist === null ? "-" : `${Math.round(dist)}m`} ·{" "}
                    {secondsAgo(p.updatedAt) <= ONLINE_WITHIN_S
                      ? "접속 중"
                      : `${Math.floor(secondsAgo(p.updatedAt) / 60)}분 전`}
                    {LEGACY.mapAttack && !isOutdoorFix(p.accuracy) && " · 실내"}
                  </span>
                </span>
                {LEGACY.mapAttack && (
                  <span style={{ color: attackable ? "#22c55e" : "#888", whiteSpace: "nowrap" }}>
                    {attackable ? "⚔️ 공격 가능" : `${ATTACK_RANGE_M}m 밖`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
