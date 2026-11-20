"use client";

import { useEffect, useRef, useState } from "react";
import { primaryButton } from "@/components/ukiki/styles";
import PreviewPlayground from "./PreviewPlayground";

// 미리보기 전체화면 팝업. 실제 방 게임 화면(가로 최대 480, 위에 제목 줄, 아래 게임 칸)과 같은 크기로 보여 준다.
// 열 때 기록(history)을 하나 쌓아서, 안드로이드·브라우저 뒤로가기는 페이지를 나가지 않고 팝업만 닫는다.
export default function PreviewPopup({
  html,
  title,
  emoji,
  version,
  onClose,
  confirmLabel,
  onConfirm,
  confirmDisabled,
}: {
  html: string;
  title: string;
  emoji: string;
  version: number;
  onClose: () => void;
  /** 팝업 아래 확정 버튼 (자동 수정된 버전을 보여 줄 때) */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
}) {
  const [run, setRun] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    history.pushState({ ukikiPreview: true }, "");
    const onPop = () => onCloseRef.current();
    window.addEventListener("popstate", onPop);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // X: 쌓아 둔 기록을 걷어 내면서 닫는다 (뒤로가기와 같은 길)
  const close = () => {
    if ((history.state as { ukikiPreview?: boolean } | null)?.ukikiPreview) history.back();
    else onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`미리보기: ${title}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "#0d0d14",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
          <span style={{ flex: "0 0 auto", padding: "4px 10px", borderRadius: 999, background: "rgba(255,216,77,.15)", border: "1px solid #ffd84d66", color: "#ffd84d", fontSize: 12, fontWeight: 800 }}>
            미리보기
          </span>
          <b style={{ flex: 1, minWidth: 0, fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {emoji} {title} <span style={{ fontSize: 13, opacity: 0.6, fontWeight: 600 }}>v{version}</span>
          </b>
          <button
            onClick={() => setRun((r) => r + 1)}
            style={{ flex: "0 0 auto", padding: "8px 10px", borderRadius: 12, border: "none", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: 13, fontWeight: 700 }}
          >
            🔁 다시 하기
          </button>
          <button
            onClick={close}
            aria-label="미리보기 닫기"
            style={{ flex: "0 0 auto", width: 38, height: 38, borderRadius: 12, border: "none", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: 18 }}
          >
            ✕
          </button>
        </header>
        <div style={{ flex: 1, minHeight: 0 }}>
          <PreviewPlayground key={run} html={html} title={title} emoji={emoji} autoStart />
        </div>
        {onConfirm && (
          <button onClick={onConfirm} disabled={confirmDisabled} style={{ ...primaryButton, flex: "0 0 auto", opacity: confirmDisabled ? 0.6 : 1 }}>
            {confirmLabel ?? "✅ 이 버전으로 확정"}
          </button>
        )}
      </div>
    </div>
  );
}
