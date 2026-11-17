import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteLocation,
  listRecentLocations,
  upsertLocation,
} from "@/lib/birthday-gacha/locations";

async function requireKakaoId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

// 지도에 표시할 플레이어 위치 목록
export async function GET() {
  const kakaoId = await requireKakaoId();
  if (!kakaoId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locations = await listRecentLocations();
  return NextResponse.json({ me: kakaoId, locations });
}

// 내 현재 위치 저장
export async function POST(request: Request) {
  const kakaoId = await requireKakaoId();
  if (!kakaoId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    lat?: unknown;
    lng?: unknown;
    accuracy?: unknown;
  } | null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const accuracy = Number(body?.accuracy);
  const valid =
    Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    Number.isFinite(lng) && Math.abs(lng) <= 180 &&
    Number.isFinite(accuracy) && accuracy >= 0;
  if (!valid) return NextResponse.json({ error: "invalid location" }, { status: 400 });

  await upsertLocation(kakaoId, { lat, lng, accuracy });
  return NextResponse.json({ ok: true });
}

// 위치 공유 끄기: 내 위치를 지운다
export async function DELETE() {
  const kakaoId = await requireKakaoId();
  if (!kakaoId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await deleteLocation(kakaoId);
  return NextResponse.json({ ok: true });
}
