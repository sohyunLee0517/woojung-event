import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우정의 온도",
  description: "The Dramatic Reveal",
};

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
