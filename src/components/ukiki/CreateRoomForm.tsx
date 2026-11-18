"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ghostButton, inputStyle, primaryButton, UK } from "./styles";

export default function CreateRoomForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const iconButton = (
    <button
      onClick={() => setOpen(true)}
      aria-label="새 방 만들기"
      title="새 방 만들기"
      style={{
        width: 42,
        height: 42,
        borderRadius: "50%",
        border: "none",
        background: UK.yellow,
        color: "#191919",
        fontSize: 26,
        fontWeight: 700,
        lineHeight: "42px",
        cursor: "pointer",
        flex: "0 0 auto",
      }}
    >
      ＋
    </button>
  );

  if (!open) return iconButton;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/ukiki/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, visibility, password }),
    }).catch(() => null);
    const data = res ? ((await res.json()) as { ok: boolean; code?: string; error?: string }) : null;
    setSaving(false);
    if (data?.ok && data.code) router.push(`/r/${data.code}`);
    else setError(data?.error ?? "방을 만들지 못했어요");
  };


  return (
    <>
    {iconButton}
    <div
      onClick={() => setOpen(false)}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
    <section
      onClick={(e) => e.stopPropagation()}
      style={{ width: "100%", maxWidth: 480, padding: "20px 16px 28px", borderRadius: "20px 20px 0 0", background: "#1c1c1c", display: "flex", flexDirection: "column", gap: 12 }}
    >
      <p style={{ fontSize: 16, fontWeight: 800 }}>새 방 만들기</p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="방 이름 (예: 4월 생일 삼총사)"
        maxLength={20}
        style={inputStyle}
      />
      <button
        type="button"
        role="switch"
        aria-checked={visibility === "private"}
        onClick={() => setVisibility((v) => (v === "private" ? "public" : "private"))}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px", border: "none", background: "none", color: "#fff", cursor: "pointer", fontSize: 15 }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>🔒 비밀방</span>
        <span
          style={{
            width: 46,
            height: 28,
            borderRadius: 14,
            padding: 3,
            background: visibility === "private" ? UK.yellow : "rgba(255,255,255,.2)",
            transition: "background .15s",
            display: "flex",
            justifyContent: visibility === "private" ? "flex-end" : "flex-start",
          }}
        >
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff" }} />
        </span>
      </button>
      {visibility === "private" && (
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (4~20자)"
          type="password"
          maxLength={20}
          style={inputStyle}
        />
      )}
      {error && <p style={{ color: "#f97316", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setOpen(false)} style={{ ...ghostButton, flex: 1 }}>
          취소
        </button>
        <button type="button" onClick={submit} disabled={saving} style={{ ...primaryButton, flex: 2, opacity: saving ? 0.6 : 1 }}>
          {saving ? "만드는 중…" : "만들기"}
        </button>
      </div>
    </section>
    </div>
    </>
  );
}
