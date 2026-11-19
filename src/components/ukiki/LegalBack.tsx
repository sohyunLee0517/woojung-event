"use client";

import { useRouter } from "next/navigation";

// 약관 페이지 뒤로가기. 플레이 스토어 등 바깥에서 바로 들어와 이전 화면이 없으면 우끼끼 첫 화면으로.
export default function LegalBack() {
  const router = useRouter();
  return (
    <button
      aria-label="뒤로가기"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      style={{ width: 38, height: 38, borderRadius: 12, border: "none", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: 18, cursor: "pointer" }}
    >
      ←
    </button>
  );
}
