import { notFound } from "next/navigation";
import AiGamePreview from "./AiGamePreview";

export const metadata = { title: "AI 게임 미리보기" };

// 로컬 개발 전용: 손으로 만든 예제 게임으로 게임 키트·미리 해 보기 흐름 확인. 운영에서는 404.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AiGamePreview />;
}
