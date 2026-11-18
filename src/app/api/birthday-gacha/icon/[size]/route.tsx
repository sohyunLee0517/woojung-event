import { ImageResponse } from "next/og";

// 홈 화면 아이콘 (192 / 512 / 180)
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number((await params).size);
  const size = [180, 192, 512].includes(n) ? n : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #2a1f00, #0a0a0a)",
          fontSize: size * 0.62,
        }}
      >
        🎂
      </div>
    ),
    { width: size, height: size, emoji: "twemoji" },
  );
}
