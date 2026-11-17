import { redirect } from "next/navigation";
import { auth } from "@/auth";
import MapView from "./MapView";

export default async function BirthdayGachaMapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/birthday-gacha");
  return <MapView />;
}
