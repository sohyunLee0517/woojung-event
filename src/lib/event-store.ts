import { db } from "@/lib/firebase";
import { ref, set, update, onValue, get, remove, onDisconnect, increment } from "firebase/database";
import type { EventState, EventStatus } from "./types";

const VIEWERS_PATH = "woojung-viewers";
const CONTRIBUTIONS_PATH = "woojung-contributions";

export interface ContributionInfo {
  nickname: string;
  total: number;
}

export function watchContributions(callback: (data: Record<string, ContributionInfo>) => void): () => void {
  return onValue(ref(db, CONTRIBUTIONS_PATH), (snap) => {
    callback(snap.exists() ? (snap.val() as Record<string, ContributionInfo>) : {});
  });
}

export async function incrementContribution(sessionId: string, nickname: string, amount: number): Promise<void> {
  const contribRef = ref(db, `${CONTRIBUTIONS_PATH}/${sessionId}`);
  await update(contribRef, { nickname, total: increment(amount) });
}

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

// 참가 시도: "ok" | "full" | "duplicate"
export async function tryJoinViewer(sessionId: string, nickname: string): Promise<"ok" | "full" | "duplicate"> {
  const snap = await get(ref(db, VIEWERS_PATH));
  if (snap.exists()) {
    const viewers = snap.val() as Record<string, ViewerInfo>;
    if (Object.keys(viewers).length >= 3) return "full";
    const isDuplicate = Object.values(viewers).some(
      (v) => v.nickname.trim().toLowerCase() === nickname.trim().toLowerCase()
    );
    if (isDuplicate) return "duplicate";
  }

  const viewerRef = ref(db, `${VIEWERS_PATH}/${sessionId}`);
  const data: ViewerInfo = { nickname, joinedAt: Date.now() };
  await set(viewerRef, data);
  onDisconnect(viewerRef).remove();
  return "ok";
}

export async function leaveViewer(sessionId: string): Promise<void> {
  await remove(ref(db, `${VIEWERS_PATH}/${sessionId}`));
}

const EVENT_PATH = "woojung-event";
const WEBRTC_PATH = "woojung-webrtc";

// ─── 상태 읽기 / 쓰기 ─────────────────────────────────────────────────────────

export function watchEventState(callback: (state: EventState) => void): () => void {
  const stateRef = ref(db, EVENT_PATH);
  const unsub = onValue(stateRef, (snap) => {
    if (snap.exists()) callback(snap.val() as EventState);
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
  await remove(ref(db, CONTRIBUTIONS_PATH));
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
