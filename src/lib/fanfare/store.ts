// 빵빠레 실시간 상태 (Firebase RTDB). 게임(uk_room_games.id)마다 경로가 따로 있다.
//
//   ukiki/fanfare/{gameId}/state            FanfareState (트랜잭션으로만 쓴다)
//   ukiki/fanfare/{gameId}/players/{kakao}  { name, image, joinedAt }  ← 접속 중인 참가자 (끊기면 자동 삭제)
//   ukiki/fanfare/{gameId}/taps/{kakao}     내 탭 수 (increment)
//   ukiki/fanfare/{gameId}/host             { kakaoId, epoch, online }  ← 카메라 켤 때마다 epoch 가 바뀐다
//   ukiki/fanfare/{gameId}/rtc/{epoch}/...  영상 연결 정보
import {
  increment,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type DatabaseReference,
} from "firebase/database";
import { db } from "@/lib/firebase";
import { applyTap, initialState, startState, type FanfareState } from "@/lib/fanfare/logic";

export type FanfarePlayer = { name: string; image: string | null; joinedAt: number };
export type FanfareHostInfo = { kakaoId: string; epoch: number; online: boolean };

export const basePath = (gameId: number | string) => `ukiki/fanfare/${gameId}`;
export const pathRef = (gameId: number | string, sub: string): DatabaseReference => ref(db, `${basePath(gameId)}/${sub}`);

// ── 서버 시각 (모두 같은 기준으로 단계·온도를 계산하기 위해) ──
let serverOffset = 0;
let offsetWatching = false;
export function serverNow() {
  if (!offsetWatching) {
    offsetWatching = true;
    onValue(ref(db, ".info/serverTimeOffset"), (s) => {
      serverOffset = Number(s.val()) || 0;
    });
  }
  return Date.now() + serverOffset;
}

function normalize(v: Partial<FanfareState> | null): FanfareState {
  return { ...initialState(), ...(v ?? {}) };
}

export function watchState(gameId: number, cb: (s: FanfareState) => void, onError?: (e: Error) => void) {
  serverNow();
  return onValue(
    pathRef(gameId, "state"),
    (snap) => cb(normalize(snap.val())),
    (e) => onError?.(e),
  );
}

export function watchPlayers(gameId: number, cb: (p: Record<string, FanfarePlayer>) => void) {
  return onValue(pathRef(gameId, "players"), (snap) => cb((snap.val() as Record<string, FanfarePlayer>) ?? {}));
}

export function watchTaps(gameId: number, cb: (t: Record<string, number>) => void) {
  return onValue(pathRef(gameId, "taps"), (snap) => cb((snap.val() as Record<string, number>) ?? {}));
}

export function watchHost(gameId: number, cb: (h: FanfareHostInfo | null) => void) {
  return onValue(pathRef(gameId, "host"), (snap) => cb((snap.val() as FanfareHostInfo) ?? null));
}

/**
 * 참가자로 접속 표시. 네트워크가 잠깐 끊겼다 돌아와도 다시 등록한다(.info/connected).
 * 돌려준 함수를 부르면 나간다.
 */
export function joinAsPlayer(gameId: number, me: { id: string; name: string; image: string | null }) {
  const myRef = pathRef(gameId, `players/${me.id}`);
  const unsub = onValue(ref(db, ".info/connected"), async (snap) => {
    if (snap.val() !== true) return;
    await onDisconnect(myRef).remove();
    await set(myRef, { name: me.name, image: me.image, joinedAt: serverTimestamp() });
  });
  return () => {
    unsub();
    void onDisconnect(myRef).cancel();
    void remove(myRef);
  };
}

/** 탭: 온도는 트랜잭션(동시에 눌러도 안 사라짐), 내 탭 수는 increment */
export async function tap(gameId: number, me: string, playerCount: number) {
  const now = serverNow();
  const result = await runTransaction(pathRef(gameId, "state"), (cur) => {
    const s = normalize(cur);
    if (s.status !== "PLAYING") return; // 진행 중이 아니면 쓰지 않는다
    return applyTap(s, now, playerCount);
  });
  if (result.committed) {
    // 탭 수는 규칙이 '진행 중(또는 100도 직후 5초)'에만 받아 준다. 늦게 도착하면 조용히 넘어간다.
    await set(pathRef(gameId, `taps/${me}`), increment(1)).catch(() => {});
  }
  return result.committed;
}

// ── 호스트 조작 ──
export async function hostStart(gameId: number) {
  const now = serverNow();
  await remove(pathRef(gameId, "taps"));
  await runTransaction(pathRef(gameId, "state"), (cur) => {
    const s = normalize(cur);
    if (s.status !== "WAITING") return;
    return startState(s, now);
  });
}

/** 호스트 접속 표시. 카메라를 켤 때마다 epoch 를 새로 써서 친구들이 영상 연결을 다시 하게 한다. */
export async function announceHost(gameId: number, kakaoId: string, epoch: number) {
  const hostRef = pathRef(gameId, "host");
  await onDisconnect(hostRef).update({ online: false });
  await set(hostRef, { kakaoId, epoch, online: true });
}

export async function hostOffline(gameId: number) {
  await update(pathRef(gameId, "host"), { online: false });
}
