"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { postToApp } from "@/lib/app-bridge";
import { ghostButton, primaryButton, UK } from "@/components/ukiki/styles";

const card: React.CSSProperties = { padding: 16, borderRadius: 16, background: UK.card, display: "flex", flexDirection: "column", gap: 10 };
const danger: React.CSSProperties = { ...ghostButton, background: "#dc2626", color: "#fff" };

// 탈퇴: 내가 만든 방을 모두 없앤 뒤에 할 수 있다. 방은 여기서 바로 없애지 않고,
// '내 방 확인하기'로 메인의 내 방 목록에 가서 방마다 들어가 직접 없앤다 (쉽게 지우지 않게).
export default function AccountDelete({ ownedCount }: { ownedCount: number }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(ownedCount);

  const leave = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/ukiki/account", { method: "DELETE" }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; rooms?: unknown[] } | null) : null;
    if (data?.ok) {
      postToApp({ type: "logout" });
      await signOut({ redirectTo: "/" });
      return;
    }
    setBusy(false);
    setConfirm(false);
    if (data?.rooms) setCount(data.rooms.length);
    else setError("탈퇴하지 못했어요. 다시 시도해 주세요.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={card}>
        <p style={{ fontWeight: 800 }}>탈퇴하면</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8, opacity: 0.85 }}>
          <li>프로필 사진, 마지막 위치, 알림 받는 기기가 지워져요</li>
          <li>들어가 있던 친구 방에서 모두 나가요</li>
          <li>친구들과 함께 한 게임 기록은 남지만 이름은 &apos;알 수 없음&apos;으로 바뀌어요</li>
          <li>다시 카카오로 로그인하면 새로 시작해요</li>
        </ul>
      </section>

      {count > 0 ? (
        <section style={card}>
          <p style={{ fontWeight: 800 }}>👑 내가 만든 방이 {count}개 남아 있어요</p>
          <p style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
            내가 만든 방을 모두 없애야 탈퇴할 수 있어요. 방에 들어가서 오른쪽 위 메뉴 → &apos;방 없애기&apos;로 없앨 수 있어요.
          </p>
          <a href="/?tab=mine" style={{ ...primaryButton, textDecoration: "none" }}>
            내 방 확인하기
          </a>
        </section>
      ) : confirm ? (
        <section style={{ ...card, background: "rgba(220,38,38,.12)", border: "1px solid rgba(220,38,38,.5)" }}>
          <p style={{ fontWeight: 800 }}>정말 탈퇴할까요? 되돌릴 수 없어요.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirm(false)} disabled={busy} style={{ ...ghostButton, flex: 1 }}>
              취소
            </button>
            <button onClick={leave} disabled={busy} style={{ ...danger, flex: 1 }}>
              {busy ? "탈퇴하는 중…" : "탈퇴하기"}
            </button>
          </div>
        </section>
      ) : (
        <button onClick={() => setConfirm(true)} style={danger}>
          회원 탈퇴
        </button>
      )}

      {error && <p style={{ fontSize: 13, color: "#f97316", textAlign: "center" }}>{error}</p>}
    </div>
  );
}
