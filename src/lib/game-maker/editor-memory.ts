// 만들기 화면 기억: 나갔다가 30분 안에 다시 들어오면 보던 그대로 (쓰다 만 프롬프트·고른 버전·스크롤 위치).
// 이 기기의 브라우저 저장소에만 둔다. 저장소가 막혀 있으면 조용히 넘어간다.

export const EDITOR_MEMORY_MS = 30 * 60_000;

export type EditorMemory = { prompt: string; selected: number | null; scrollY: number };
export type MemoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const key = (aiId: number) => `ukiki:maker:${aiId}`;

export function saveEditorMemory(storage: MemoryStorage, aiId: number, m: EditorMemory, now: number) {
  try {
    storage.setItem(key(aiId), JSON.stringify({ ...m, savedAt: now }));
  } catch {
    // 저장소가 막힌 환경 (사생활 보호 모드 등)
  }
}

export function loadEditorMemory(storage: MemoryStorage, aiId: number, now: number): EditorMemory | null {
  try {
    const raw = storage.getItem(key(aiId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<EditorMemory> & { savedAt?: number };
    if (typeof v.savedAt !== "number" || now - v.savedAt > EDITOR_MEMORY_MS) {
      storage.removeItem(key(aiId));
      return null;
    }
    return {
      prompt: typeof v.prompt === "string" ? v.prompt : "",
      selected: typeof v.selected === "number" ? v.selected : null,
      scrollY: typeof v.scrollY === "number" ? v.scrollY : 0,
    };
  } catch {
    return null;
  }
}

export function clearEditorMemory(storage: MemoryStorage, aiId: number) {
  try {
    storage.removeItem(key(aiId));
  } catch {
    // 무시
  }
}

/** 저장해 둔 버전이 아직 있으면 그 버전, 없으면 최신 버전 */
export function pickVersion(versions: number[], saved: number | null): number | null {
  if (versions.length === 0) return null;
  return saved !== null && versions.includes(saved) ? saved : versions[versions.length - 1];
}
