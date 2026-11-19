import { notFound } from "next/navigation";
import SnackPreview from "./SnackPreview";

export const metadata = { title: "과자 미리보기" };

// 로컬 개발 전용 미리보기. 운영에서는 404.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SnackPreview />;
}
