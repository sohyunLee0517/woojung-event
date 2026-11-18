import { ImageResponse } from "next/og";

// 파비콘 (🐵 우끼끼)
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FEE500", borderRadius: 16, fontSize: 46 }}>
        🐵
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
