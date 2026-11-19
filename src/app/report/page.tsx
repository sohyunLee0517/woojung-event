import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TopBar from "@/components/ukiki/TopBar";
import { columnStyle, pageStyle } from "@/components/ukiki/styles";
import { REPORT_CATEGORIES } from "@/lib/ukiki/reports";
import ReportForm from "./ReportForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "신고하기 · 우끼끼" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const { room } = await searchParams;
  const me = (await auth())?.user?.id;
  if (!me) redirect(`/?next=${encodeURIComponent(room ? `/report?room=${room}` : "/report")}`);
  return (
    <main style={pageStyle}>
      <div style={{ ...columnStyle, minHeight: "100%" }}>
        <TopBar backHref={room ? `/r/${room}` : "/"} title="🚨 신고하기" />
        <ReportForm categories={REPORT_CATEGORIES.map((c) => ({ ...c }))} roomCode={room ?? null} />
      </div>
    </main>
  );
}
