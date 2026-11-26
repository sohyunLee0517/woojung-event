// 위치 기반 규칙에 쓰는 값들. 숫자만 바꾸면 규칙이 바뀐다.

/**
 * GPS 오차 반경이 이 값(m) 이하일 때만 '야외'로 본다.
 * 실내에서는 GPS 대신 와이파이·기지국으로 위치를 잡아 오차가 커지므로, 오차로 실내를 걸러 낸다.
 */
export const OUTDOOR_MAX_ACCURACY_M = 30;

/** 이 시간 넘게 갱신이 없는 위치는 지도에서 숨긴다. */
export const LOCATION_STALE_MS = 10 * 60 * 1000;

/** 내 위치를 서버에 보내는 최소 간격 */
export const LOCATION_SEND_INTERVAL_MS = 5 * 1000;

/** 다른 사람 위치를 다시 불러오는 간격 */
export const LOCATION_POLL_INTERVAL_MS = 4 * 1000;

/** 두 좌표 사이 거리(m). 하버사인 공식. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isOutdoorFix(accuracy: number): boolean {
  return accuracy <= OUTDOOR_MAX_ACCURACY_M;
}
