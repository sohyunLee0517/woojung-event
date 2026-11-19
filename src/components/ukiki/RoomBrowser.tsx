"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomPage, RoomSummary } from "@/lib/ukiki/rooms";
import { GAME_META, ghostButton, inputStyle, scrollAreaStyle, UK } from "./styles";

function RoomRow({ room }: { room: RoomSummary }) {
  return (
    <Link
      href={`/r/${room.code}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 14,
        background: UK.card,
        color: "#fff",
        textDecoration: "none",
      }}
    >
      <span style={{ fontSize: 20 }}>{room.visibility === "private" ? "🔒" : "🌏"}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {room.name}
        </span>
        <span style={{ display: "block", fontSize: 12, opacity: 0.6 }}>
          {room.ownerName ?? "?"}님 방 · 👥 {room.members}
          {room.activeGames.length > 0 && ` · ${room.activeGames.map((g) => GAME_META[g].emoji).join(" ")} 진행 중`}
        </span>
      </span>
      {room.isMember && <span style={{ fontSize: 13, opacity: 0.8, color: UK.yellow, flex: "0 0 auto" }}>참여 중</span>}
    </Link>
  );
}

export default function RoomBrowser({ initial, initialTab = "all" }: { initial: RoomPage; initialTab?: "all" | "mine" }) {
  const [tab, setTab] = useState<"all" | "mine">(initialTab);
  const [q, setQ] = useState("");
  const [items, setItems] = useState(initial.items);
  const [nextOffset, setNextOffset] = useState(initial.nextOffset);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  // 처음 받은 목록은 '전체' 탭 것이라, '내 방'으로 시작하면 바로 다시 불러온다
  const first = useRef(initialTab === "all");

  const fetchPage = useCallback(async (opts: { q: string; tab: "all" | "mine"; offset: number }) => {
    const sp = new URLSearchParams();
    if (opts.q) sp.set("q", opts.q);
    if (opts.offset) sp.set("offset", String(opts.offset));
    if (opts.tab === "mine") sp.set("mine", "1");
    const res = await fetch(`/api/ukiki/rooms?${sp}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return null;
    return (await res.json()) as RoomPage & { ok: boolean };
  }, []);

  // 검색어·탭이 바뀌면 처음부터 다시 (입력 멈추고 0.3초 뒤)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const page = await fetchPage({ q: q.trim(), tab, offset: 0 });
      if (id !== reqId.current) return;
      setLoading(false);
      if (page) {
        setItems(page.items);
        setNextOffset(page.nextOffset);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, tab, fetchPage]);

  const more = async () => {
    if (loading || nextOffset === null) return;
    setLoading(true);
    const page = await fetchPage({ q: q.trim(), tab, offset: nextOffset });
    setLoading(false);
    if (page) {
      setItems((prev) => [...prev, ...page.items.filter((r) => !prev.some((p) => p.code === r.code))]);
      setNextOffset(page.nextOffset);
    }
  };

  const tabStyle = (active: boolean) => ({
    ...ghostButton,
    padding: "7px 14px",
    borderRadius: 999,
    background: active ? "#fff" : "rgba(255,255,255,.08)",
    color: active ? "#111" : "#fff",
  });

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 방 이름 검색"
        maxLength={20}
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setTab("all")} style={tabStyle(tab === "all")}>
          전체 방
        </button>
        <button onClick={() => setTab("mine")} style={tabStyle(tab === "mine")}>
          내 방
        </button>
      </div>

      <div style={scrollAreaStyle}>
      {items.length === 0 && !loading && (
        <p style={{ fontSize: 13, opacity: 0.6, padding: "12px 0", textAlign: "center" }}>
          {q ? `'${q.trim()}' 방이 없어요` : tab === "mine" ? "아직 들어간 방이 없어요" : "아직 방이 없어요. ＋로 첫 방을 만들어 보세요!"}
        </p>
      )}
      {items.map((r) => (
        <RoomRow key={r.code} room={r} />
      ))}
      {nextOffset !== null && (
        <button onClick={more} disabled={loading} style={{ ...ghostButton, opacity: loading ? 0.6 : 1 }}>
          {loading ? "불러오는 중…" : "더보기"}
        </button>
      )}
      </div>
    </section>
  );
}
