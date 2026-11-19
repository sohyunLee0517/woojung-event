import { notFound } from "next/navigation";
import FanfarePreview from "./FanfarePreview";

export const metadata = { title: "빵빠레 미리보기" };

// 로컬 개발 전용 화면 미리보기 (스토리북처럼 상태별로 보기). 운영에서는 404.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FanfarePreview />;
}
