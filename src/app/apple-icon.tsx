import { ImageResponse } from "next/og";

// 아이폰 홈 화면 아이콘
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FEE500", fontSize: 120 }}>
        🐵
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
