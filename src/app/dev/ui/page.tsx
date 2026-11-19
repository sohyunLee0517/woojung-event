import { notFound } from "next/navigation";
import UiPreview from "./UiPreview";

export const metadata = { title: "공통 컴포넌트 미리보기" };

// 로컬 개발 전용: 공통 컴포넌트를 상태별로 본다. 운영에서는 404.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiPreview />;
}
