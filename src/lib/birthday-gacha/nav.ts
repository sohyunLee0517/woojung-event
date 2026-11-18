// 지도는 방 안에 있다. 방 지도에서 '← 방으로'를 누르면 그 방으로 돌아간다.
const ROOM_CODE = /^[A-Z0-9]{6}$/;

export function roomMapHref(roomCode: string | null | undefined): string | null {
  return roomCode && ROOM_CODE.test(roomCode) ? `/r/${roomCode}/map` : null;
}
