"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

export default function BackButton({ style }: { style?: CSSProperties }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/birthday-gacha"))}
      style={style}
    >
      ← 뒤로가기
    </button>
  );
}
