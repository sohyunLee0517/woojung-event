import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { mapBack } from "@/lib/birthday-gacha/nav";
import MapView from "./MapView";

export default async function BirthdayGachaMapPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/birthday-gacha");
  const { from } = await searchParams;
  const back = mapBack(from);
  return <MapView backHref={back.href} backLabel={back.label} />;
}
