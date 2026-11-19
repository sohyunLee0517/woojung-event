import { notFound } from "next/navigation";
import PiratePreview from "./PiratePreview";

export const metadata = { title: "해적 미리보기" };

// 로컬 개발 전용 미리보기. 운영에서는 404.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PiratePreview />;
}
