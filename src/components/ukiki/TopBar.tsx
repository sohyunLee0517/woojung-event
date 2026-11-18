import Link from "next/link";
import type { ReactNode } from "react";

/** 모든 화면 공통 상단: 왼쪽 뒤로가기(←) + 제목 + 오른쪽 버튼들 */
export default function TopBar({
  backHref,
  title,
  sub,
  right,
}: {
  backHref?: string;
  title?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
      {backHref && (
        <Link
          href={backHref}
          aria-label="뒤로가기"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "rgba(255,255,255,.1)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            textDecoration: "none",
            flex: "0 0 auto",
          }}
        >
          ←
        </Link>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <p style={{ fontSize: 18, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
        )}
        {sub}
      </div>
      {right}
    </header>
  );
}
