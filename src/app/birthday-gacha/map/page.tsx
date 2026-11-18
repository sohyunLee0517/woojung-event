import { redirect } from "next/navigation";

// 지도는 이제 각 방 안에 있다 (/r/방코드/map)
export default function OldMapPage() {
  redirect("/");
}
