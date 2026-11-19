"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PastGame } from "@/lib/ukiki/rooms";
import { yen } from "@/lib/birthday-gacha/rules";
import { GAME_META, ghostButton, UK } from "./styles";

function when(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PastGameCard({ game }: { game: PastGame }) {
  const [open, setOpen] = useState(false);
  const meta = GAME_META[game.type];
  return (
    <div style={{ borderRadius: 14, background: UK.card, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "none", background: "none", color: "#fff", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontSize: 22 }}>{meta.emoji}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 14 }}>{meta.label}</b>
          {game.outcome === "aborted" && (
            <span style={{ marginLeft: 6, fontSize: 11, padding: "1px 6px", borderRadius: 6, background: "rgba(248,113,113,.18)", color: "#f87171" }}>
              중단
            </span>
          )}
          <span style={{ display: "block", fontSize: 12, opacity: 0.6 }}>
            {when(game.endedAt)} · 👥 {game.participants.length}
            {game.gachaResult?.[0] && ` · 👑 ${game.gachaResult[0].nickname ?? "?"}`}
            {game.type === "fanfare" && ` · 호스트 ${game.hostName ?? "?"}`}
          </span>
        </span>
        <span aria-hidden style={{ opacity: 0.5, display: "inline-block", transform: open ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .2s" }}>›</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
          {game.gachaResult
            ? game.gachaResult.map((r) => (
                <div key={r.kakaoId} style={{ display: "flex", gap: 8 }}>
                  <span style={{ width: 28, opacity: 0.7 }}>{r.badge || `${r.rank}등`}</span>
                  <span style={{ flex: 1 }}>{r.nickname ?? "?"}</span>
                  <span>{yen(r.money)}</span>
                  <span style={{ width: 44, textAlign: "right", opacity: 0.7 }}>{r.minutes}분</span>
                </div>
              ))
            : game.fanfareResult
              ? game.fanfareResult.map((r) => (
                  <div key={r.kakaoId} style={{ display: "flex", gap: 8 }}>
                    <span style={{ width: 28, opacity: 0.8 }}>{["🥇", "🥈", "🥉"][r.rank - 1] ?? `${r.rank}등`}</span>
                    <span style={{ flex: 1 }}>{r.nickname ?? "?"}</span>
                    <span>{r.taps}탭</span>
                  </div>
                ))
              : game.participants.map((p) => (
                <div key={p.kakaoId} style={{ display: "flex", gap: 8 }}>
                  <span style={{ width: 28 }}>{p.kakaoId === game.hostKakaoId ? "🎥" : "🙌"}</span>
                  <span style={{ flex: 1 }}>{p.nickname ?? "?"}</span>
                  <span style={{ opacity: 0.6 }}>{p.kakaoId === game.hostKakaoId ? "호스트" : "참여"}</span>
                </div>
              ))}
          {game.type === "gacha" && game.refCode && (
            <Link href={`/birthday-gacha/g/${game.refCode}`} style={{ fontSize: 12, color: UK.yellow }}>
              뽑기 기록 자세히 보기 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function PastGames({ code }: { code: string }) {
  const [items, setItems] = useState<PastGame[] | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (offset: number) => {
    setLoading(true);
    const res = await fetch(`/api/ukiki/rooms/${code}/past?offset=${offset}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { items: PastGame[]; nextOffset: number | null }) : null;
    setLoading(false);
    if (!data) return;
    setItems((prev) => (offset === 0 ? data.items : [...(prev ?? []), ...data.items]));
    setNextOffset(data.nextOffset);
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // 지난 게임이 없으면(또는 아직 불러오는 중이면) 영역을 아예 안 보여 준다
  if (!items || items.length === 0) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800 }}>📜 지난 게임</h2>
      {items.map((g) => <PastGameCard key={g.id} game={g} />)}
      {nextOffset !== null && (
        <button onClick={() => load(nextOffset)} disabled={loading} style={{ ...ghostButton, opacity: loading ? 0.6 : 1 }}>
          {loading ? "불러오는 중…" : "더보기"}
        </button>
      )}
    </section>
  );
}
