"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { RoomDetail } from "@/lib/ukiki/rooms";
import type { ActiveFanfare } from "@/lib/ukiki/rules";
import PastGames from "./PastGames";
import { fixedColumnStyle, fixedPageStyle, GAME_META, ghostButton, primaryButton, scrollAreaStyle, UK } from "./styles";
import TopBar from "./TopBar";

const POLL_MS = 4000;

function Avatar({ src, online, size = 34 }: { src: string | null; online: boolean; size?: number }) {
  return (
    <span style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src.replace(/^http:\/\//, "https://")}
          alt=""
          width={size}
          height={size}
          style={{ borderRadius: "50%", objectFit: "cover", width: size, height: size }}
        />
      ) : (
        <span style={{ display: "block", width: size, height: size, borderRadius: "50%", background: "#333" }} />
      )}
      <span
        style={{
          position: "absolute",
          right: -1,
          bottom: -1,
          width: 10,
          height: 10,
          borderRadius: "50%",
          border: "2px solid #0a0a0a",
          background: online ? "#22c55e" : "#6b7280",
        }}
      />
    </span>
  );
}

export default function RoomView({ initial, me }: { initial: RoomDetail; me: string }) {
  const router = useRouter();
  const [room, setRoom] = useState(initial);
  const [busy, setBusy] = useState<"fanfare" | "gacha" | null>(null);
  const [conflict, setConflict] = useState<{ message: string; active: ActiveFanfare } | null>(null);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    const res = await fetch(`/api/ukiki/rooms/${room.code}/leave`, { method: "POST" }).catch(() => null);
    const data = res ? ((await res.json()) as { ok: boolean }) : null;
    setLeaving(false);
    if (data?.ok) router.push("/");
    else {
      setConfirmLeave(false);
      setNotice("방을 나가지 못했어요.");
    }
  };

  const load = useCallback(async () => {
    const res = await fetch(`/api/ukiki/rooms/${initial.code}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { ok: boolean; room: RoomDetail };
    if (data.ok) setRoom(data.room);
  }, [initial.code]);

  useEffect(() => {
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const fanfarePath = (id: number) => `/r/${room.code}/fanfare/${id}`;

  const openFanfare = async () => {
    if (busy) return;
    setBusy("fanfare");
    const res = await fetch(`/api/ukiki/rooms/${room.code}/fanfare`, { method: "POST" }).catch(() => null);
    const data = res
      ? ((await res.json()) as
          | { kind: "created"; id: number }
          | { kind: "conflict"; message: string; active: ActiveFanfare }
          | { kind: "retry" | "not_member" | "unauthorized" })
      : null;
    setBusy(null);
    if (data?.kind === "created") router.push(fanfarePath(data.id));
    else if (data?.kind === "conflict") setConflict({ message: data.message, active: data.active });
    else if (data?.kind === "retry") setNotice("방금 빵빠레가 끝났어요. 다시 눌러 주세요.");
    else setNotice("빵빠레를 열지 못했어요.");
    load();
  };

  const openGacha = async () => {
    if (busy) return;
    setBusy("gacha");
    const res = await fetch(`/api/ukiki/rooms/${room.code}/gacha`, { method: "POST" }).catch(() => null);
    const data = res ? ((await res.json()) as { ok: boolean; gachaCode?: string }) : null;
    setBusy(null);
    if (data?.ok && data.gachaCode) router.push(`/birthday-gacha/g/${data.gachaCode}`);
    else setNotice("가챠를 열지 못했어요.");
  };

  const invite = async () => {
    const url = `${location.origin}/r/${room.code}`;
    const text = `🐵 우끼끼 '${room.name}' 방으로 와!${room.visibility === "private" ? " (비밀번호는 따로 알려 줄게)" : ""}`;
    try {
      if (navigator.share) return void (await navigator.share({ title: "우끼끼", text, url }));
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setNotice("초대 링크를 복사했어요.");
    } catch {
      // 공유 창을 닫은 경우
    }
  };

  const fanfare = room.games.find((g) => g.type === "fanfare");
  const gachas = room.games.filter((g) => g.type === "gacha");
  const onlineCount = room.members.filter((m) => m.online).length;

  return (
    <main style={fixedPageStyle}>
      <div style={fixedColumnStyle}>
        <TopBar
          backHref="/"
          title={`${room.visibility === "private" ? "🔒 " : ""}${room.name}`}
          sub={
            <button onClick={invite} style={{ background: "none", border: "none", color: UK.yellow, fontSize: 13, padding: 0, cursor: "pointer" }}>
              방 {room.code} · 초대하기 ↗
            </button>
          }
          right={
            <>
              <Link href={`/r/${room.code}/map`} aria-label="방 지도" title="방 지도" style={{ ...ghostButton, padding: "8px 12px" }}>
                🗺️
              </Link>
              <div style={{ position: "relative" }}>
                <button onClick={() => setMenuOpen((v) => !v)} aria-label="방 메뉴" style={{ ...ghostButton, padding: "8px 12px" }}>
                  ⋯
                </button>
                {menuOpen && (
                  <>
                    <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 44,
                        zIndex: 41,
                        minWidth: 140,
                        padding: 6,
                        borderRadius: 12,
                        background: "#1c1c1c",
                        border: `1px solid ${UK.line}`,
                        boxShadow: "0 8px 24px rgba(0,0,0,.4)",
                      }}
                    >
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmLeave(true);
                        }}
                        style={{ width: "100%", padding: "10px 12px", border: "none", borderRadius: 8, background: "none", color: "#f87171", fontSize: 14, textAlign: "left", cursor: "pointer" }}
                      >
                        방 나가기
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          }
        />

        <section style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {room.members.map((m) => (
            <span key={m.kakaoId} title={m.nickname ?? ""} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Avatar src={m.image} online={m.online} />
            </span>
          ))}
          <span style={{ fontSize: 13, opacity: 0.7, marginLeft: 4 }}>
            {onlineCount}명 접속 · 멤버 {room.members.length}
          </span>
        </section>

        <div style={{ ...scrollAreaStyle, gap: 18 }}>
        {notice && (
          <p onClick={() => setNotice("")} style={{ fontSize: 13, color: UK.yellow, cursor: "pointer" }}>
            {notice}
          </p>
        )}

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800 }}>🔥 진행 중</h2>
          {!fanfare && gachas.length === 0 && <p style={{ fontSize: 13, opacity: 0.6 }}>아직 열린 게임이 없어요. 아래에서 하나 열어 보세요!</p>}
          {fanfare && (
            <Link href={fanfarePath(fanfare.id)} style={{ ...gameCard, borderColor: "rgba(254,229,0,.5)" }}>
              <span style={{ fontSize: 26 }}>{GAME_META.fanfare.emoji}</span>
              <span style={{ flex: 1 }}>
                <b>빵빠레</b>
                <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>
                  {fanfare.hostKakaoId === me ? "내가 호스트" : `${fanfare.hostName ?? "친구"}님이 호스트`}
                </span>
              </span>
              <span style={{ ...ghostButton, background: UK.yellow, color: "#191919" }}>{fanfare.hostKakaoId === me ? "열기" : "참여"}</span>
            </Link>
          )}
          {gachas.map((g) => (
            <Link key={g.id} href={`/birthday-gacha/g/${g.refCode}`} style={gameCard}>
              <span style={{ fontSize: 26 }}>{GAME_META.gacha.emoji}</span>
              <span style={{ flex: 1 }}>
                <b>생일 가챠</b>
                <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>{g.hostName ?? "친구"}님이 열었어요</span>
              </span>
              <span style={ghostButton}>입장</span>
            </Link>
          ))}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800 }}>🎮 새 게임 열기</h2>
          <button onClick={openFanfare} disabled={!!busy} style={{ ...gameCard, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            <span style={{ fontSize: 26 }}>{GAME_META.fanfare.emoji}</span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <b>빵빠레 열기</b>
              <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>내가 호스트(카메라) · 방마다 1개만 진행돼요</span>
            </span>
            <span>{busy === "fanfare" ? "…" : "＋"}</span>
          </button>
          <button onClick={openGacha} disabled={!!busy} style={{ ...gameCard, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            <span style={{ fontSize: 26 }}>{GAME_META.gacha.emoji}</span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <b>생일 가챠 열기</b>
              <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>{GAME_META.gacha.desc}</span>
            </span>
            <span>{busy === "gacha" ? "…" : "＋"}</span>
          </button>
        </section>

        <PastGames code={room.code} />
        </div>
      </div>

      {confirmLeave && (
        <div
          onClick={() => !leaving && setConfirmLeave(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 340, padding: 20, borderRadius: 18, background: "#1c1c1c", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}
          >
            <p style={{ fontSize: 17, fontWeight: 800 }}>&apos;{room.name}&apos;에서 나갈까요?</p>
            <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
              {room.members.length <= 1
                ? "마지막 멤버라서 나가면 방이 없어져요."
                : room.ownerKakaoId === me
                  ? "방장은 가장 먼저 들어온 친구에게 넘어가요."
                  : "같이 한 게임 기록은 방에 남아요."}
              {room.visibility === "private" && room.members.length > 1 && " 다시 들어오려면 비밀번호가 필요해요."}
              {fanfare?.hostKakaoId === me && " 내가 연 빵빠레는 끝나요."}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmLeave(false)} disabled={leaving} style={{ ...ghostButton, flex: 1 }}>
                취소
              </button>
              <button onClick={leave} disabled={leaving} style={{ ...ghostButton, flex: 1, background: "#dc2626", opacity: leaving ? 0.6 : 1 }}>
                {leaving ? "나가는 중…" : "나가기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {conflict && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ width: "100%", maxWidth: 340, padding: 20, borderRadius: 18, background: "#1c1c1c", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 36 }}>🎉</p>
            <p style={{ fontSize: 17, fontWeight: 800 }}>{conflict.message}</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>빵빠레는 방마다 하나씩만 열 수 있어요. 지금 열린 빵빠레에 바로 참여할까요?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConflict(null)} style={{ ...ghostButton, flex: 1 }}>
                나가기
              </button>
              <button onClick={() => router.push(fanfarePath(conflict.active.id))} style={{ ...primaryButton, flex: 2 }}>
                참여하기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const gameCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 16,
  background: UK.card,
  border: "1px solid transparent",
  color: "#fff",
  textDecoration: "none",
  fontSize: 15,
  width: "100%",
};
