import { db } from "@/lib/firebase";
import { ref, set, update, onValue, get, remove, onDisconnect } from "firebase/database";
import type { EventState, EventStatus } from "./types";

const VIEWERS_PATH = "woojung-viewers";

export interface ViewerInfo {
  nickname: string;
  joinedAt: number;
}

// 현재 참가자 목록 구독
export function watchViewers(callback: (viewers: Record<string, ViewerInfo>) => void): () => void {
  const unsub = onValue(ref(db, VIEWERS_PATH), (snap) => {
    callback(snap.exists() ? (snap.val() as Record<string, ViewerInfo>) : {});
  });
  return unsub;
}

// 참가 시도: 성공 시 true, 정원 초과 시 false
export async function tryJoinViewer(sessionId: string, nickname: string): Promise<boolean> {
  const snap = await get(ref(db, VIEWERS_PATH));
  const current = snap.exists() ? Object.keys(snap.val()).length : 0;
  if (current >= 3) return false;

  const viewerRef = ref(db, `${VIEWERS_PATH}/${sessionId}`);
  const data: ViewerInfo = { nickname, joinedAt: Date.now() };
  await set(viewerRef, data);
  // 연결 끊기면 자동 삭제
  onDisconnect(viewerRef).remove();
  return true;
}

export async function leaveViewer(sessionId: string): Promise<void> {
  await remove(ref(db, `${VIEWERS_PATH}/${sessionId}`));
}

const EVENT_PATH = "woojung-event";
const WEBRTC_PATH = "woojung-webrtc";

// ─── 상태 읽기 / 쓰기 ─────────────────────────────────────────────────────────

export function watchEventState(callback: (state: EventState) => void): () => void {
  const stateRef = ref(db, EVENT_PATH);
  const defaultState: EventState = { status: "WAITING", temperature: 0 };
  const unsub = onValue(stateRef, (snap) => {
    const state: EventState = snap.exists()
      ? (snap.val() as EventState)
      : defaultState;
    callback(state);
  });
  return unsub;
}

export async function getEventState(): Promise<EventState | null> {
  const snap = await get(ref(db, EVENT_PATH));
  return snap.exists() ? (snap.val() as EventState) : null;
}

export async function initEventState(): Promise<void> {
  await set(ref(db, EVENT_PATH), { status: "WAITING", temperature: 0 } satisfies EventState);
  await remove(ref(db, WEBRTC_PATH));
  await remove(ref(db, VIEWERS_PATH));
}

export async function setStatus(status: EventStatus): Promise<void> {
  await update(ref(db, EVENT_PATH), { status });
}

export async function setTemperature(temperature: number): Promise<void> {
  const clamped = Math.round(Math.min(100, Math.max(0, temperature)) * 10) / 10;
  await update(ref(db, EVENT_PATH), { temperature: clamped });
}

export async function resetEvent(): Promise<void> {
  await initEventState();
}
