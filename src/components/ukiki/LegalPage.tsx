import type { ReactNode } from "react";

// 개인정보처리방침·계정 삭제 안내 같은 공개 문서 (로그인 없이 볼 수 있다)
export const CONTACT_EMAIL = "ukiki.service@kakao.com";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main style={{ height: "100%", overflowY: "auto", background: "#0a0a0a", color: "#fff" }}>
      <article style={{ maxWidth: 680, margin: "0 auto", padding: "28px 18px 60px", lineHeight: 1.75, fontSize: 15 }}>
        <p style={{ fontSize: 28 }}>🐵</p>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: "4px 0" }}>{title}</h1>
        <p style={{ fontSize: 13, opacity: 0.55 }}>우끼끼 (우리끼리) · 시행일 {updated}</p>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 22 }}>{children}</div>
        <p style={{ marginTop: 32, fontSize: 13, opacity: 0.55 }}>문의: {CONTACT_EMAIL}</p>
      </article>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{title}</h2>
      <div style={{ opacity: 0.88 }}>{children}</div>
    </section>
  );
}

export const listStyle = { margin: 0, paddingLeft: 20, listStyleType: "disc" } as const;
export const stepStyle = { margin: 0, paddingLeft: 20, listStyleType: "decimal" } as const;
