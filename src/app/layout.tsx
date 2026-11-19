import type { Metadata, Viewport } from "next";
import NoPinchZoom from "@/components/NoPinchZoom";
import "./globals.css";

export const metadata: Metadata = {
  title: "우끼끼 · 우리끼리",
  description: "우리끼리 하는 미니게임 천국",
  manifest: "/ukiki.webmanifest",
  appleWebApp: { capable: true, title: "우끼끼", statusBarStyle: "black-translucent" },
};

// 아이폰은 입력칸 글자가 16px 보다 작으면 포커스될 때 화면을 확대한다 → 확대 배율을 1로 고정
export const viewport: Viewport = { themeColor: "#0a0a0a", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <NoPinchZoom />
        <div className="fixed inset-0 overflow-hidden" style={{ background: "#0a0a0a" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
