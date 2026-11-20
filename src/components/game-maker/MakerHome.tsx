"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import TopBar from "@/components/ukiki/TopBar";
import { ghostButton, pageStyle, columnStyle, primaryButton, UK } from "@/components/ukiki/styles";
import { BANANAS_PER_PLAY, BANANAS_PER_WIN, PROMPT_COST } from "@/lib/bananas/rules";
import type { AiGameSummary } from "@/lib/game-maker/store";

const card: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, background: UK.card, color: "#fff", textDecoration: "none" };

export function BananaChip({ balance }: { balance: number | null }) {
  return (
    <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(255,216,77,.15)", border: "1px solid #ffd84d55", color: "#ffd84d", fontWeight: 800, fontSize: 14 }}>
      🍌 {balance ?? "…"}
    </span>
  );
}

// 우리가 만든 게임: 방에서 할 수 있는 게임 목록 + 내가 만드는 중인 게임 + 새로 만들기
export default function MakerHome({ roomCode, me }: { roomCode: string; me: string }) {
  const router = useRouter();
  const [published, setPublished] = useState<AiGameSummary[] | null>(null);
  const [draft, setDraft] = useState<AiGameSummary | null>(null);
  const [limit, setLimit] = useState(10);
  const [ask, setAsk] = useState<"choose" | "confirm_new" | null>(null);
  const [removing, setRemoving] = useState<AiGameSummary | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; href?: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ukiki/rooms/${roomCode}/maker`, { cache: "no-store" }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; published: AiGameSummary[]; draft: AiGameSummary | null; limit: number; balance: number } | null) : null;
    if (!data?.ok) return;
    setPublished(data.published);
    setDraft(data.draft);
    setLimit(data.limit);
    setBalance(data.balance);
  }, [roomCode]);
  useEffect(() => void load(), [load]);

  // 새로 만들기: 만들던 게임(임시저장)이 있으면 [이어 만들기 / 새로 만들기] 를 먼저 묻는다
  const startNew = () => {
    if (draft) setAsk("choose");
    else void create(false);
  };

  const create = async (replace: boolean) => {
    if (busy) return;
    setBusy(true);
    setAsk(null);
    const res = await fetch(`/api/ukiki/rooms/${roomCode}/maker`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ replace }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; id?: number; reason?: string } | null) : null;
    setBusy(false);
    if (data?.ok && data.id) return router.push(`/r/${roomCode}/maker/${data.id}`);
    if (data?.reason === "draft_exists" && data.id) return router.push(`/r/${roomCode}/maker/${data.id}`);
    if (data?.reason === "full") setNotice({ text: `방 게임이 ${limit}개로 가득 찼어요. 내가 만든 게임을 지우면 새로 만들 수 있어요.` });
    else if (data?.reason === "busy") setNotice({ text: "AI가 아직 이전 게임을 만드는 중이에요. 끝난 뒤에 다시 해 주세요." });
    else if (data?.reason === "disabled") setNotice({ text: "지금은 게임 만들기가 쉬고 있어요." });
    else setNotice({ text: "게임을 만들지 못했어요." });
  };

  const remove = async (g: AiGameSummary) => {
    setRemoving(null);
    setBusy(true);
    const res = await fetch(`/api/ukiki/rooms/${roomCode}/maker/${g.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) setNotice({ text: "지우지 못했어요." });
    await load();
  };

  const play = async (g: AiGameSummary) => {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/ukiki/rooms/${roomCode}/ai`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aiGameId: g.id }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { kind: string; id?: number; message?: string } | null) : null;
    setBusy(false);
    if (data?.kind === "created" && data.id) router.push(`/r/${roomCode}/ai/${data.id}`);
    else if (data?.kind === "conflict" && data.id) setNotice({ text: data.message ?? "이미 열린 게임이 있어요", href: `/r/${roomCode}/ai/${data.id}` });
    else if (data?.kind === "retry") setNotice({ text: "방금 게임이 끝났어요. 다시 눌러 주세요." });
    else if (data?.kind === "disabled") setNotice({ text: "지금은 쉬고 있는 게임이에요." });
    else setNotice({ text: "게임을 열지 못했어요." });
  };

  return (
    <main style={pageStyle}>
      <div style={{ ...columnStyle, gap: 16 }}>
        <TopBar backHref={`/r/${roomCode}`} title="🤖 우리가 만든 게임" right={<BananaChip balance={balance} />} />

        <div style={{ padding: 14, borderRadius: 16, background: "rgba(255,216,77,.08)", border: "1px solid #ffd84d33", fontSize: 13, lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 6 }}>
          <p>
            <b>🍌 바나나 모으기</b>
            <br />
            게임 한 판 참여 <b>+{BANANAS_PER_PLAY}</b> · 1등(또는 팀 전체 성공) <b>+{BANANAS_PER_WIN}</b>
          </p>
          <p>
            <b>🤖 바나나 쓰기</b>
            <br />
            AI 게임 프롬프트 1번 <b>−{PROMPT_COST}</b> (AI가 못 만들면 돌려받아요)
          </p>
        </div>

        <button onClick={startNew} disabled={busy || (published !== null && published.length >= limit)} style={{ ...primaryButton, opacity: busy || (published !== null && published.length >= limit) ? 0.5 : 1 }}>
          {draft ? "✨ 게임 만들기 (만들던 게임 있음)" : "✨ 새 게임 만들기"}
        </button>
        {(published !== null && published.length >= limit) && <p style={{ fontSize: 12, color: "#ffd84d", textAlign: "center" }}>방 게임이 {limit}개로 가득 찼어요. 내가 만든 게임을 지우면 새로 만들 수 있어요.</p>}

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800 }}>
            🎮 우리 방 게임 <span style={{ fontSize: 12, opacity: 0.6 }}>({published?.length ?? 0}/{limit})</span>
          </h2>
          {published === null && <p style={{ fontSize: 13, opacity: 0.5 }}>불러오는 중…</p>}
          {published?.length === 0 && <p style={{ fontSize: 13, opacity: 0.6 }}>아직 확정된 게임이 없어요. 첫 게임을 만들어 볼까요?</p>}
          {published?.map((g) => (
            <div key={g.id} style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 30 }}>{g.emoji}</span>
                <span style={{ flex: 1 }}>
                  <b>{g.title}</b>
                  <span style={{ display: "block", fontSize: 12, opacity: 0.6 }}>{g.creatorName ?? "친구"}님이 만들었어요</span>
                </span>
              </div>
              {g.rules && <p style={{ fontSize: 13, opacity: 0.8 }}>📜 {g.rules}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => play(g)} disabled={busy} style={{ ...primaryButton, flex: 1, padding: "10px 12px", opacity: busy ? 0.6 : 1 }}>
                  ▶ 같이 하기
                </button>
                {g.creatorId === me && (
                  <button onClick={() => setRemoving(g)} aria-label="내가 만든 게임 지우기" style={{ ...ghostButton, display: "flex", alignItems: "center" }}>
                    🗑️
                  </button>
                )}
                <Link
                  href={`/report?room=${roomCode}&aiGame=${g.id}`}
                  aria-label="이 게임 신고하기"
                  style={{ ...ghostButton, textDecoration: "none", display: "flex", alignItems: "center" }}
                >
                  🚩
                </Link>
              </div>
            </div>
          ))}
        </section>
      </div>

      {ask && (
        <div
          onClick={() => setAsk(null)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, padding: 20, borderRadius: 20, background: "#1c1c1c", display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
            {ask === "choose" ? (
              <>
                <p style={{ fontSize: 36 }}>{draft?.emoji ?? "🛠️"}</p>
                <p style={{ fontWeight: 800 }}>만들던 게임이 있어요</p>
                {draft && draft.versions > 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>“{draft.title}” · 프롬프트 {draft.versions}번</p>}
                <Link href={`/r/${roomCode}/maker/${draft?.id}`} style={{ ...primaryButton, textDecoration: "none" }}>
                  이어 만들기
                </Link>
                <button onClick={() => setAsk("confirm_new")} style={ghostButton}>
                  새로 만들기
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 36 }}>⚠️</p>
                <p style={{ fontWeight: 800 }}>이전에 만들던 게임은 삭제됩니다</p>
                <p style={{ fontSize: 13, opacity: 0.7 }}>쓴 바나나는 돌아오지 않아요. 새로 만들까요?</p>
                <button onClick={() => create(true)} style={{ ...primaryButton, background: "#ff6b6b", color: "#fff" }}>
                  삭제하고 새로 만들기
                </button>
                <button onClick={() => setAsk(null)} style={ghostButton}>
                  취소
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {removing && (
        <div
          onClick={() => setRemoving(null)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, padding: 20, borderRadius: 20, background: "#1c1c1c", display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
            <p style={{ fontSize: 36 }}>{removing.emoji}</p>
            <p style={{ fontWeight: 800 }}>“{removing.title}” 을(를) 지울까요?</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>방 게임 목록에서 빠져요. 지난 게임 기록은 남아요.</p>
            <button onClick={() => remove(removing)} style={{ ...primaryButton, background: "#ff6b6b", color: "#fff" }}>
              지우기
            </button>
            <button onClick={() => setRemoving(null)} style={ghostButton}>
              취소
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div
          onClick={() => setNotice(null)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, padding: 20, borderRadius: 20, background: "#1c1c1c", display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>
            <p style={{ fontWeight: 700 }}>{notice.text}</p>
            {notice.href && (
              <Link href={notice.href} style={{ ...primaryButton, textDecoration: "none" }}>
                그 게임에 참여하기
              </Link>
            )}
            <button onClick={() => setNotice(null)} style={ghostButton}>
              닫기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
