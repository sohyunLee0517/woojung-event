import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우끼끼 · 우리끼리",
  description: "우리끼리 하는 미니게임 천국",
  manifest: "/ukiki.webmanifest",
  appleWebApp: { capable: true, title: "우끼끼", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0a0a0a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="fixed inset-0 overflow-hidden" style={{ background: "#0a0a0a" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
