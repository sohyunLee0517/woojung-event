import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { CSSProperties } from "react";
import { auth } from "@/auth";
import { adminAccess, adminIds } from "@/lib/birthday-gacha/admin";
import { getAdminOverview } from "@/lib/birthday-gacha/admin-data";
import { notifyQuizWindow } from "@/lib/birthday-gacha/notify";
import BackButton from "./BackButton";
import { stickyHeaderStyle } from "@/components/ukiki/TopBar";

export const dynamic = "force-dynamic";

const page: CSSProperties = {
  height: "100%",
  overflowY: "auto",
  color: "#fff",
  fontFamily: "sans-serif",
};

const button: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "rgba(255,255,255,.12)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const iconBack: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "none",
  background: "rgba(255,255,255,.1)",
  color: "#fff",
  fontSize: 18,
  cursor: "pointer",
};

function clock(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminPage() {
  const session = await auth();
  const access = adminAccess(session?.user?.id, adminIds());

  if (access === "login") redirect("/?next=/birthday-gacha/admin");

  if (access === "forbidden") {
    return (
      <main style={page}>
        <div style={{ maxWidth: 420, minHeight: "100%", margin: "0 auto", padding: "16px 16px", display: "flex", flexDirection: "column" }}>
          <header style={{ display: "flex" }}>
            <BackButton style={iconBack} />
          </header>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", paddingBottom: 80 }}>
            <p style={{ fontSize: 40 }}>🔒</p>
            <p style={{ fontSize: 17, fontWeight: 700 }}>관리자만 볼 수 있는 화면이에요</p>
            <p style={{ fontSize: 14, opacity: 0.7 }}>필요하면 관리자에게 요청해 주세요.</p>
          </div>
        </div>
      </main>
    );
  }

  const overview = await getAdminOverview();
  const missed = overview.rows.filter((r) => r.warning === "이번 알림 누락").length;

  return (
    <main style={page}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={stickyHeaderStyle}>
          <BackButton style={iconBack} />
          <h1 style={{ flex: 1, fontSize: 18, fontWeight: 800 }}>🛠 관리자</h1>
        </header>

        <section style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,.06)" }}>
          <p style={{ fontSize: 13, opacity: 0.7 }}>지금 퀴즈 구간</p>
          <p style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{overview.windowLabel}</p>
          <p style={{ fontSize: 13, marginTop: 6, color: missed > 0 ? "#f97316" : "#86efac" }}>
            {missed > 0 ? `⚠️ 알림 누락 ${missed}명` : "✅ 누락 없음"}
          </p>
          <form
            action={async () => {
              "use server";
              const s = await auth();
              if (adminAccess(s?.user?.id, adminIds()) !== "ok") return;
              await notifyQuizWindow();
              revalidatePath("/birthday-gacha/admin");
            }}
            style={{ marginTop: 10 }}
          >
            <button type="submit" style={{ ...button, background: "#FEE500", color: "#191919" }}>
              🔔 아직 못 받은 사람에게 지금 보내기
            </button>
          </form>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>👥 플레이어 알림 현황 (최근 14일 방)</h2>
          {overview.rows.length === 0 && <p style={{ opacity: 0.6, fontSize: 14 }}>아직 플레이어가 없어요.</p>}
          {overview.rows.map((r) => (
            <div
              key={r.kakaoId}
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(255,255,255,.05)",
                border: r.warning ? "1px solid rgba(249,115,22,.6)" : "1px solid transparent",
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>{r.online ? "🟢" : "⚪"}</span>
                <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{r.nickname ?? "이름 없음"}</span>
                {r.warning && <span style={{ color: "#f97316", fontWeight: 700 }}>⚠️ {r.warning}</span>}
              </div>
              <p style={{ opacity: 0.85 }}>
                {r.pushOn
                  ? `🔔 알림 받는 기기: ${r.targetDevice} (마지막 접속) · 등록 ${r.devices}대`
                  : "🔕 알림 안 켬"}
              </p>
              <p style={{ opacity: 0.85 }}>
                마지막 퀴즈 알림 {clock(r.lastNotifiedAt)} · 이번 구간 {r.notifiedThisWindow ? "보냄" : "안 보냄"}
                {r.answeredThisWindow ? " · 퀴즈 완료" : ""}
              </p>
              <p style={{ opacity: 0.6 }}>
                마지막 접속 {clock(r.lastSeenAt)} · 방 {r.games.join(", ")}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
