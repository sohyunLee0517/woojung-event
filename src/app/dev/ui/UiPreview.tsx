"use client";

import { useState } from "react";
import Toggle from "@/components/ukiki/Toggle";

const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,.06)" };

export default function UiPreview() {
  const [on, setOn] = useState(true);
  return (
    <main style={{ minHeight: "100dvh", background: "#0a0a0a", color: "#fff", padding: 16, display: "flex", flexDirection: "column", gap: 12, maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 800 }}>🧩 공통 컴포넌트</h1>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>Toggle</h2>
      <div style={row}>
        <span style={{ flex: 1 }}>눌러 보기</span>
        <Toggle checked={on} onToggle={() => setOn(!on)} label="눌러 보기" />
      </div>
      <div style={row}>
        <span style={{ flex: 1 }}>켜짐</span>
        <Toggle checked label="켜짐" />
      </div>
      <div style={row}>
        <span style={{ flex: 1 }}>꺼짐</span>
        <Toggle checked={false} label="꺼짐" />
      </div>
      <div style={row}>
        <span style={{ flex: 1 }}>막힘</span>
        <Toggle checked disabled label="막힘" />
      </div>
    </main>
  );
}
