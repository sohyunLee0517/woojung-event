import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "생일 가챠",
  manifest: "/birthday-gacha.webmanifest",
  appleWebApp: { capable: true, title: "생일 가챠", statusBarStyle: "black-translucent" },
  icons: { apple: "/api/birthday-gacha/icon/180" },
};

export const viewport: Viewport = { themeColor: "#0a0a0a" };

export default function BirthdayGachaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
