import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteLocation, upsertLocation } from "@/lib/birthday-gacha/locations";
import { listRoomLocations } from "@/lib/ukiki/map";
import { verifyLocationToken } from "@/lib/app-location-token";

async function requireKakaoId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** 웹 로그인 또는 앱 위치 토큰(백그라운드 위치). 위치 저장에만 토큰을 받는다. */
async function locationWriter(request: Request) {
  const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (bearer) return verifyLocationToken(bearer, process.env.AUTH_SECRET ?? "");
  return requireKakaoId();
}

// 방 지도에 표시할 위치 목록 (?room=코드). 그 방 멤버 위치만 준다.
export async function GET(request: Request) {
  const kakaoId = await requireKakaoId();
  if (!kakaoId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const room = (new URL(request.url).searchParams.get("room") ?? "").toUpperCase();
  const locations = await listRoomLocations(room, kakaoId);
  if (!locations) return NextResponse.json({ error: "not_member" }, { status: 403 });
  return NextResponse.json({ me: kakaoId, locations });
}

// 내 현재 위치 저장
export async function POST(request: Request) {
  const kakaoId = await locationWriter(request);
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
