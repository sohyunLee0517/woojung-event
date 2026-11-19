"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomDetail } from "@/lib/ukiki/rooms";
import type { ActiveFanfare } from "@/lib/ukiki/rules";
import PastGames from "./PastGames";
import { MIN_PLAYERS, joinedMembers, roomSections } from "@/lib/ukiki/room-view";
import { fixedColumnStyle, fixedPageStyle, GAME_META, ghostButton, primaryButton, scrollAreaStyle, UK } from "./styles";
import TopBar from "./TopBar";
import { LEGACY } from "@/lib/ukiki/legacy";
import PushCard from "@/app/birthday-gacha/g/[code]/PushCard";

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
  const [busy, setBusy] = useState<"fanfare" | "gacha" | "pirate" | null>(null);
  const [conflict, setConflict] = useState<{ message: string; emoji: string; href: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOwner = room.ownerKakaoId === me;

  const removeRoom = async () => {
    if (leaving) return;
    setLeaving(true);
    const res = await fetch(`/api/ukiki/rooms/${room.code}`, { method: "DELETE" }).catch(() => null);
    setLeaving(false);
    if (res?.ok) router.push("/?tab=mine");
    else {
      setConfirmDelete(false);
      setNotice("방을 없애지 못했어요.");
    }
  };

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

  const [welcome, setWelcome] = useState<string | null>(null);
  const memberIdsRef = useRef<string[] | null>(initial.members.map((m) => m.kakaoId));

  const load = useCallback(async () => {
    const res = await fetch(`/api/ukiki/rooms/${initial.code}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { ok: boolean; room: RoomDetail };
    if (!data.ok) return;
    // 새로 들어온 친구가 있으면 반겨 준다
    const joined = joinedMembers(memberIdsRef.current, data.room.members).filter((m) => m.kakaoId !== me);
    memberIdsRef.current = data.room.members.map((m) => m.kakaoId);
    setRoom(data.room);
    if (joined.length > 0) {
      setWelcome(`${joined.map((m) => m.nickname ?? "친구").join(", ")}님이 들어왔어요!`);
      setTimeout(() => setWelcome(null), 3000);
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.4 }, zIndex: 70 });
    }
  }, [initial.code, me]);

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
          | { kind: "retry" | "not_member" | "unauthorized" | "disabled" })
      : null;
    setBusy(null);
    if (data?.kind === "created") router.push(fanfarePath(data.id));
    else if (data?.kind === "conflict")
      setConflict({ message: data.message, emoji: GAME_META.fanfare.emoji, href: fanfarePath(data.active.id) });
    else if (data?.kind === "retry") setNotice("방금 빵빠레가 끝났어요. 다시 눌러 주세요.");
    else if (data?.kind === "disabled") setNotice("지금은 쉬고 있는 게임이에요.");
    else setNotice("빵빠레를 열지 못했어요.");
    load();
  };

  const pirateGamePath = (id: number) => `/r/${room.code}/pirate/${id}`;
  const openPirate = async () => {
    if (busy) return;
    setBusy("pirate");
    const res = await fetch(`/api/ukiki/rooms/${room.code}/pirate`, { method: "POST" }).catch(() => null);
    const data = res
      ? ((await res.json()) as { kind: "created"; id: number } | { kind: "conflict"; id: number; message: string } | { kind: string })
      : null;
    setBusy(null);
    if (data?.kind === "created" && "id" in data) router.push(pirateGamePath(data.id));
    else if (data?.kind === "conflict" && "message" in data)
      setConflict({ message: data.message, emoji: GAME_META.pirate.emoji, href: pirateGamePath(data.id) });
    else if (data?.kind === "retry") setNotice("방금 해적 게임이 끝났어요. 다시 눌러 주세요.");
    else if (data?.kind === "disabled") setNotice("지금은 쉬고 있는 게임이에요.");
    else setNotice("해적 무찌르기를 열지 못했어요.");
    load();
  };

  const openGacha = async () => {
    if (busy) return;
    setBusy("gacha");
    const res = await fetch(`/api/ukiki/rooms/${room.code}/gacha`, { method: "POST" }).catch(() => null);
    const data = res
      ? ((await res.json()) as
          | { kind: "created"; gachaCode: string }
          | { kind: "conflict"; message: string; active: { gachaCode: string } }
          | { kind: "retry" | "not_member" | "unauthorized" | "disabled" })
      : null;
    setBusy(null);
    if (data?.kind === "created") router.push(`/birthday-gacha/g/${data.gachaCode}`);
    else if (data?.kind === "conflict")
      setConflict({ message: data.message, emoji: GAME_META.gacha.emoji, href: `/birthday-gacha/g/${data.active.gachaCode}` });
    else if (data?.kind === "retry") setNotice("방금 가챠가 끝났어요. 다시 눌러 주세요.");
    else if (data?.kind === "disabled") setNotice("지금은 쉬고 있는 게임이에요.");
    else setNotice("가챠를 열지 못했어요.");
    load();
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

  const sections = roomSections({ memberCount: room.members.length });
  const fanfare = room.games.find((g) => g.type === "fanfare");
  const [picker, setPicker] = useState(false);
  const pick = (open: () => Promise<void>) => {
    setPicker(false);
    void open();
  };
  const gachas = room.games.filter((g) => g.type === "gacha");
  const pirates = room.games.filter((g) => g.type === "pirate");
  const onlineCount = room.members.filter((m) => m.online).length;

  return (
    <main style={fixedPageStyle}>
      <style>{`
        @keyframes uk-ping { 0% { transform: scale(1); opacity: .8 } 100% { transform: scale(1.6); opacity: 0 } }
        @keyframes uk-heart { 0%,100% { transform: scale(1) } 50% { transform: scale(1.25) } }
        @keyframes uk-dots { to { width: 1.2em } }
        @keyframes uk-pop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.85) } 12% { opacity: 1; transform: translate(-50%, -50%) scale(1) } 85% { opacity: 1 } 100% { opacity: 0 } }
      `}</style>
      {welcome && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            top: "45%",
            zIndex: 80,
            padding: "18px 22px",
            borderRadius: 18,
            background: "rgba(20,20,20,.94)",
            border: "1px solid rgba(254,229,0,.5)",
            textAlign: "center",
            animation: "uk-pop 3s ease forwards",
            pointerEvents: "none",
          }}
        >
          <p style={{ fontSize: 32 }}>🎉</p>
          <p style={{ fontSize: 16, fontWeight: 800 }}>{welcome}</p>
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>이제 같이 게임할 수 있어요</p>
        </div>
      )}
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
              {sections.games && (
                <Link href={`/r/${room.code}/map`} aria-label="방 지도" title="방 지도" style={{ ...ghostButton, padding: "8px 12px" }}>
                  🗺️
                </Link>
              )}
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
{!isOwner && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmLeave(true);
                        }}
                        style={{ width: "100%", padding: "10px 12px", border: "none", borderRadius: 8, background: "none", color: "#f87171", fontSize: 14, textAlign: "left", cursor: "pointer" }}
                      >
                        방 나가기
                      </button>
                      )}
                      <a
                        href={`/report?room=${room.code}`}
                        style={{ display: "block", padding: "10px 12px", borderRadius: 8, color: "#fff", fontSize: 14, textDecoration: "none" }}
                      >
                        신고하기
                      </a>
                      {isOwner && (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirmDelete(true);
                          }}
                          style={{ width: "100%", padding: "10px 12px", border: "none", borderRadius: 8, background: "none", color: "#f87171", fontSize: 14, textAlign: "left", cursor: "pointer" }}
                        >
                          방 없애기
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          }
        />

        {sections.games && (
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
        )}

        <div style={{ ...scrollAreaStyle, gap: 18 }}>
        {notice && (
          <p onClick={() => setNotice("")} style={{ fontSize: 13, color: UK.yellow, cursor: "pointer" }}>
            {notice}
          </p>
        )}

        {sections.invite && (
          <div style={{ flex: 1, minHeight: "70%", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 40 }}>
          <section
            style={{
              width: "100%",
              padding: "28px 20px 20px",
              borderRadius: 20,
              background: "linear-gradient(160deg, rgba(254,229,0,.14), rgba(255,255,255,.03))",
              border: "1px solid rgba(254,229,0,.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {(() => {
                const self = room.members.find((m) => m.kakaoId === me);
                return <Avatar src={self?.image ?? null} online size={64} />;
              })()}
              <span style={{ fontSize: 22, opacity: 0.6, animation: "uk-heart 1.2s ease-in-out infinite" }}>💛</span>
              <span
                style={{
                  position: "relative",
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: "2px dashed rgba(254,229,0,.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  color: UK.yellow,
                }}
              >
                <span style={{ position: "absolute", inset: -2, borderRadius: "50%", border: "2px solid rgba(254,229,0,.6)", animation: "uk-ping 1.6s ease-out infinite" }} />
                ?
              </span>
            </div>
            <p style={{ fontSize: 17, fontWeight: 800 }}>
              친구를 기다리는 중
              <span style={{ display: "inline-block", width: 18, textAlign: "left" }}>
                <span style={{ animation: "uk-dots 1.4s steps(4, end) infinite", display: "inline-block", overflow: "hidden", verticalAlign: "bottom", width: 0 }}>…</span>
              </span>
            </p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>모든 게임은 {MIN_PLAYERS}명부터 할 수 있어요. 친구가 들어오면 바로 알려 줄게요.</p>
            <button onClick={invite} style={{ ...primaryButton, width: "100%" }}>
              💌 친구 부르기
            </button>
            {room.visibility === "private" && <p style={{ fontSize: 12, opacity: 0.6 }}>🔒 비밀방이라 비밀번호도 함께 알려 주세요</p>}
          </section>
          </div>
        )}

        {sections.games && (
          <>
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800 }}>🔥 진행 중</h2>
          {!fanfare && gachas.length === 0 && pirates.length === 0 && <p style={{ fontSize: 13, opacity: 0.6 }}>아직 열린 게임이 없어요. 새 게임을 만들어 보세요!</p>}
          {fanfare && (
            <Link href={fanfarePath(fanfare.id)} style={{ ...gameCard, borderColor: "rgba(254,229,0,.5)" }}>
              <span style={{ fontSize: 26 }}>{GAME_META.fanfare.emoji}</span>
              <span style={{ flex: 1 }}>
                <b>빵빠레</b>
                <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>
                  {LEGACY.fanfareHost
                    ? fanfare.hostKakaoId === me
                      ? "내가 호스트"
                      : `${fanfare.hostName ?? "친구"}님이 호스트`
                    : `${fanfare.hostName ?? "친구"}님이 열었어요`}
                </span>
              </span>
              <span style={{ ...ghostButton, background: UK.yellow, color: "#191919" }}>
                {LEGACY.fanfareHost && fanfare.hostKakaoId === me ? "열기" : "참여"}
              </span>
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
          {pirates.map((g) => (
            <Link key={g.id} href={pirateGamePath(g.id)} style={gameCard}>
              <span style={{ fontSize: 26 }}>{GAME_META.pirate.emoji}</span>
              <span style={{ flex: 1 }}>
                <b>{GAME_META.pirate.label}</b>
                <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>{g.hostName ?? "친구"}님이 열었어요</span>
              </span>
              <span style={ghostButton}>참여</span>
            </Link>
          ))}
        </section>

        <PushCard
          code={room.code}
          onNotice={(title) => setNotice(title)}
          buttonStyle={{ ...ghostButton, padding: "6px 12px", fontSize: 13 }}
          onLabel="새 게임·재촉 알림이 이 기기로 와요"
          offLabel="새 게임이 열리면 알림 받기"
          testUrl={`/r/${room.code}`}
        />
        <button onClick={() => setPicker(true)} disabled={!!busy} style={{ ...primaryButton, width: "100%", opacity: busy ? 0.6 : 1 }}>
          {busy ? "여는 중…" : "＋ 새 게임 만들기"}
        </button>

          </>
        )}
        <PastGames code={room.code} />
        </div>
      </div>

      {confirmDelete && (
        <div
          onClick={() => !leaving && setConfirmDelete(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 340, padding: 20, borderRadius: 18, background: "#1c1c1c", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}
          >
            <p style={{ fontSize: 17, fontWeight: 800 }}>&apos;{room.name}&apos; 방을 없앨까요?</p>
            <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
              친구들도 모두 나가게 되고, 이 방의 지난 게임 기록도 함께 사라져요. 되돌릴 수 없어요.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDelete(false)} disabled={leaving} style={{ ...ghostButton, flex: 1 }}>
                취소
              </button>
              <button onClick={removeRoom} disabled={leaving} style={{ ...ghostButton, flex: 1, background: "#dc2626", opacity: leaving ? 0.6 : 1 }}>
                {leaving ? "없애는 중…" : "방 없애기"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            </p>
            {fanfare?.hostKakaoId === me && (
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.55)", fontSize: 13, lineHeight: 1.5 }}>
                ⚠️ 내가 연 <b>빵빠레가 진행 중</b>이에요.
                <br />
                나가면 게임이 <b>중단</b>되고 지난 게임에 &apos;중단&apos;으로 기록돼요.
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmLeave(false)} disabled={leaving} style={{ ...ghostButton, flex: 1 }}>
                취소
              </button>
              <button onClick={leave} disabled={leaving} style={{ ...ghostButton, flex: 1, background: "#dc2626", opacity: leaving ? 0.6 : 1 }}>
                {leaving ? "나가는 중…" : fanfare?.hostKakaoId === me ? "중단하고 나가기" : "나가기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {picker && (
        <div
          onClick={() => setPicker(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 480, padding: "20px 16px 28px", borderRadius: "20px 20px 0 0", background: "#1c1c1c", display: "flex", flexDirection: "column", gap: 10 }}
          >
            <p style={{ fontSize: 17, fontWeight: 800, textAlign: "center" }}>🎮 어떤 게임을 할까요?</p>
            {(
              [
                ["fanfare", openFanfare],
                ["gacha", openGacha],
                ["pirate", openPirate],
              ] as const
            )
              .filter(([type]) => room.enabledGames?.[type] !== false)
              .map(([type, open]) => (
              <button key={type} onClick={() => pick(open)} style={{ ...gameCard, cursor: "pointer", border: "1px solid rgba(255,255,255,.12)" }}>
                <span style={{ fontSize: 30 }}>{GAME_META[type].emoji}</span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <b>{GAME_META[type].label}</b>
                  <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>{GAME_META[type].desc}</span>
                </span>
                <span style={{ fontSize: 18, opacity: 0.6 }}>›</span>
              </button>
            ))}
            <button onClick={() => setPicker(false)} style={{ ...ghostButton, marginTop: 4 }}>
              닫기
            </button>
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
            <p style={{ fontSize: 36 }}>{conflict.emoji}</p>
            <p style={{ fontSize: 17, fontWeight: 800 }}>{conflict.message}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConflict(null)} style={{ ...ghostButton, flex: 1 }}>
                나가기
              </button>
              <button onClick={() => router.push(conflict.href)} style={{ ...primaryButton, flex: 2 }}>
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
