"use client";

import { useState } from "react";
import { UK } from "./styles";
import { postToApp } from "@/lib/app-bridge";

/** 내 프로필 사진 + 이름. 사진을 누르면 로그아웃 메뉴가 나온다. */
export default function ProfileMenu({
  name,
  image,
  logout,
}: {
  name: string;
  image: string | null;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="내 프로필"
        style={{ border: "none", background: "none", padding: 0, cursor: "pointer", flex: "0 0 auto" }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.replace(/^http:\/\//, "https://")}
            alt=""
            width={42}
            height={42}
            style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span style={{ display: "block", width: 42, height: 42, borderRadius: "50%", background: "#333" }} />
        )}
      </button>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 18, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
        <p style={{ fontSize: 11, opacity: 0.45 }}>우끼끼 · 우리끼리</p>
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              top: 50,
              left: 0,
              zIndex: 41,
              minWidth: 140,
              padding: 6,
              borderRadius: 12,
              background: "#1c1c1c",
              border: `1px solid ${UK.line}`,
              boxShadow: "0 8px 24px rgba(0,0,0,.4)",
            }}
          >
            <form action={logout} onSubmit={() => postToApp({ type: "logout" })}>
              <button
                type="submit"
                style={{ width: "100%", padding: "10px 12px", border: "none", borderRadius: 8, background: "none", color: "#fff", fontSize: 14, textAlign: "left", cursor: "pointer" }}
              >
                로그아웃
              </button>
            </form>
            <a
              href="/privacy"
              style={{ display: "block", padding: "10px 12px", borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, textDecoration: "none" }}
            >
              개인정보처리방침
            </a>
            <a
              href="/account"
              style={{ display: "block", padding: "10px 12px", borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, textDecoration: "none" }}
            >
              회원 탈퇴
            </a>
          </div>
        </>
      )}
    </div>
  );
}
