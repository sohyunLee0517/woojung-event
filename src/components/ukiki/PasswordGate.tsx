"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { columnStyle, inputStyle, pageStyle, primaryButton } from "./styles";
import TopBar from "./TopBar";

export default function PasswordGate({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    setError("");
    const res = await fetch(`/api/ukiki/rooms/${code}/enter`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    const data = res ? ((await res.json()) as { ok: boolean; result?: string }) : null;
    setChecking(false);
    if (data?.ok) router.refresh();
    else setError(data?.result === "not_found" ? "없는 방이에요" : "비밀번호가 달라요");
  };

  return (
    <main style={pageStyle}>
      <div style={{ ...columnStyle, minHeight: "100%" }}>
      <TopBar backHref="/" />
      <form onSubmit={submit} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", textAlign: "center", paddingBottom: 80 }}>
        <p style={{ fontSize: 44 }}>🔒</p>
        <p style={{ fontSize: 20, fontWeight: 800 }}>{name}</p>
        <p style={{ fontSize: 14, opacity: 0.7 }}>비밀방이에요. 방장한테 받은 비밀번호를 입력해 주세요.</p>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          maxLength={20}
          style={{ ...inputStyle, textAlign: "center" }}
        />
        {error && <p style={{ color: "#f97316", fontSize: 13 }}>{error}</p>}
        <button type="submit" disabled={checking || !password} style={{ ...primaryButton, opacity: checking || !password ? 0.6 : 1 }}>
          {checking ? "확인 중…" : "입장하기"}
        </button>
      </form>
      </div>
    </main>
  );
}
