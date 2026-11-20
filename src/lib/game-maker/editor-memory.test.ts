import { describe, expect, it } from "vitest";
import { clearEditorMemory, EDITOR_MEMORY_MS, loadEditorMemory, pickVersion, saveEditorMemory, type MemoryStorage } from "./editor-memory";

function fakeStorage(): MemoryStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const broken: MemoryStorage = {
  getItem: () => {
    throw new Error("막힘");
  },
  setItem: () => {
    throw new Error("막힘");
  },
  removeItem: () => {
    throw new Error("막힘");
  },
};

describe("만들기 화면 30분 기억", () => {
  it("게임마다 따로 저장하고, 30분 안이면 그대로 돌려준다", () => {
    const s = fakeStorage();
    saveEditorMemory(s, 52, { prompt: "더 빠르게", selected: 2, scrollY: 340 }, 1_000);
    saveEditorMemory(s, 53, { prompt: "다른 게임", selected: 1, scrollY: 0 }, 1_000);
    expect(loadEditorMemory(s, 52, 1_000 + EDITOR_MEMORY_MS - 1)).toEqual({ prompt: "더 빠르게", selected: 2, scrollY: 340 });
    expect(loadEditorMemory(s, 53, 2_000)?.prompt).toBe("다른 게임");
  });

  it("30분이 지나면 무시하고 지운다", () => {
    expect(EDITOR_MEMORY_MS).toBe(30 * 60_000);
    const s = fakeStorage();
    saveEditorMemory(s, 52, { prompt: "x", selected: 1, scrollY: 0 }, 0);
    expect(loadEditorMemory(s, 52, EDITOR_MEMORY_MS + 1)).toBeNull();
    expect(s.data.size).toBe(0);
  });

  it("지우면 다음엔 없다 (확정·삭제할 때)", () => {
    const s = fakeStorage();
    saveEditorMemory(s, 52, { prompt: "x", selected: 1, scrollY: 0 }, 0);
    clearEditorMemory(s, 52);
    expect(loadEditorMemory(s, 52, 1)).toBeNull();
  });

  it("저장소가 막혀 있거나 값이 깨져도 오류 없이 넘어간다", () => {
    expect(() => saveEditorMemory(broken, 1, { prompt: "", selected: null, scrollY: 0 }, 0)).not.toThrow();
    expect(loadEditorMemory(broken, 1, 0)).toBeNull();
    expect(() => clearEditorMemory(broken, 1)).not.toThrow();
    const s = fakeStorage();
    s.setItem("ukiki:maker:9", "{깨짐");
    expect(loadEditorMemory(s, 9, 0)).toBeNull();
  });

  it("저장한 버전이 없어졌으면 최신 버전으로", () => {
    expect(pickVersion([1, 2, 3], 2)).toBe(2);
    expect(pickVersion([1, 2, 3], 7)).toBe(3);
    expect(pickVersion([1, 2, 3], null)).toBe(3);
    expect(pickVersion([], 2)).toBeNull();
  });
});
