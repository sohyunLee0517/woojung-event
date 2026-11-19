import { headers } from "next/headers";
import TopBar from "@/components/ukiki/TopBar";
import { columnStyle, ghostButton, pageStyle, primaryButton, UK } from "@/components/ukiki/styles";
import { APK_URL, downloadPlan } from "@/lib/ukiki/app-download";

export const dynamic = "force-dynamic";
export const metadata = { title: "앱 받기 · 우끼끼" };

const card: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: UK.card,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

function Steps({ items }: { items: string[] }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 14, opacity: 0.9 }}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ol>
  );
}

// 우끼끼 안드로이드 앱 받기 (APK). 아이폰은 홈 화면에 추가 안내.
export default async function AppDownloadPage() {
  const ua = (await headers()).get("user-agent");
  const plan = downloadPlan(ua);

  return (
    <main style={pageStyle}>
      <div style={{ ...columnStyle, minHeight: "100%" }}>
        <TopBar backHref="/" title="📲 우끼끼 앱 받기" />

        <section style={{ ...card, alignItems: "center", textAlign: "center" }}>
          <p style={{ fontSize: 48 }}>🐵</p>
          <p style={{ fontSize: 18, fontWeight: 800 }}>우끼끼 · 우리끼리</p>
          <p style={{ fontSize: 13, opacity: 0.7 }}>퀴즈 알림, 방 지도 위치, 우정의 온도 게임를 앱에서 더 편하게</p>
        </section>

        {plan.kind === "already" && (
          <section style={card}>
            <p style={{ fontWeight: 800 }}>✅ 이미 우끼끼 앱으로 보고 있어요</p>
          </section>
        )}

        {plan.kind === "apk" && (
          <section style={card}>
            {plan.warnInApp && (
              <p style={{ fontSize: 13, color: UK.yellow }}>
                ⚠️ 카톡 같은 앱 안에서 열면 다운로드가 막힐 수 있어요. 오른쪽 위 메뉴 → &apos;다른 브라우저로 열기&apos;로 열어 주세요.
              </p>
            )}
            <a href={APK_URL} style={{ ...primaryButton, textDecoration: "none" }}>
              🤖 안드로이드 앱 받기 (APK)
            </a>
            <Steps
              items={[
                "위 버튼으로 ukiki.apk 를 받아요",
                "다운로드가 끝나면 알림이나 '파일' 앱에서 ukiki.apk 를 눌러요",
                "'출처를 알 수 없는 앱' 경고가 나오면 → 설정 → '이 출처 허용'을 켜요",
                "설치 → 열기 → 카카오로 로그인",
                "카메라·마이크·위치·알림을 허용해요 (위치는 꼭!)",
              ]}
            />
            <p style={{ fontSize: 12, opacity: 0.55 }}>
              새 버전이 나오면 이 페이지에서 다시 받아 설치하면 돼요. 플레이스토어 테스트 버전이 깔려 있으면 먼저 지워 주세요.
            </p>
          </section>
        )}

        {plan.kind === "ios_home" && (
          <section style={card}>
            <p style={{ fontWeight: 800 }}>🍎 아이폰은 홈 화면에 추가해서 써요</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>아이폰은 앱스토어 밖에서 앱을 설치할 수 없어요. 홈 화면에 추가하면 앱처럼 열리고 알림도 와요.</p>
            <Steps
              items={[
                "Safari 로 이 사이트를 열어요",
                "아래쪽 공유 버튼(□↑) → '홈 화면에 추가'",
                "홈 화면의 🐵 우끼끼로 열고 카카오로 로그인",
                "방에 들어가 🔔 알림 '켜기'를 눌러요 (iOS 16.4 이상)",
              ]}
            />
            <a href="/" style={{ ...ghostButton, textDecoration: "none" }}>
              우끼끼 열기
            </a>
          </section>
        )}

        {plan.kind === "open_on_phone" && (
          <section style={card}>
            <p style={{ fontWeight: 800 }}>📱 휴대폰으로 이 페이지를 열어 주세요</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>안드로이드는 앱을, 아이폰은 홈 화면에 추가하는 방법을 보여 드려요.</p>
            <p style={{ fontSize: 13, wordBreak: "break-all", color: UK.yellow }}>woojung-event-lgam.vercel.app/app</p>
            <a href={APK_URL} style={{ ...ghostButton, textDecoration: "none" }}>
              안드로이드 APK 직접 받기
            </a>
          </section>
        )}
      </div>
    </main>
  );
}
