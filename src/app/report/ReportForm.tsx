"use client";

import { useState } from "react";
import { primaryButton, UK } from "@/components/ukiki/styles";

const field: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${UK.line}`,
  background: "rgba(255,255,255,.06)",
  color: "#fff",
  fontSize: 15,
};

// 신고 내용은 관리자만 봐요. 아동 안전 신고는 관련 기관에도 알려요.
export default function ReportForm({
  categories,
  roomCode,
}: {
  categories: { value: string; label: string }[];
  roomCode: string | null;
}) {
  const [category, setCategory] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/ukiki/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category, body, roomCode }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; error?: string } | null) : null;
    setBusy(false);
    if (data?.ok) setDone(true);
    else setError(data?.error ?? "신고를 보내지 못했어요. 다시 시도해 주세요.");
  };

  if (done) {
    return (
      <div style={{ padding: 20, borderRadius: 16, background: UK.card, textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 36 }}>✅</p>
        <p style={{ fontWeight: 800 }}>신고를 받았어요</p>
        <p style={{ fontSize: 13, opacity: 0.7 }}>확인한 뒤 필요한 조치를 할게요. 알려 주셔서 고마워요.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
        신고 내용은 관리자만 볼 수 있어요. 아동을 위험하게 하는 내용은 확인 즉시 조치하고 관련 기관에 알려요.
        {roomCode && ` (방 ${roomCode})`}
      </p>
      <select value={category} onChange={(e) => setCategory(e.target.value)} required style={field} aria-label="신고 종류">
        <option value="" disabled>
          신고 종류를 골라 주세요
        </option>
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        rows={6}
        placeholder="무슨 일이 있었는지 적어 주세요 (누가, 어느 방에서, 언제)"
        aria-label="신고 내용"
        style={{ ...field, resize: "vertical" }}
      />
      {error && <p style={{ fontSize: 13, color: "#f97316" }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }}>
        {busy ? "보내는 중…" : "신고 보내기"}
      </button>
    </form>
  );
}
