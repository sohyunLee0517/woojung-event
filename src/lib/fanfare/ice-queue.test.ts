import { describe, expect, it } from "vitest";
import { IceQueue } from "./ice-queue";

describe("IceQueue (연결 정보가 먼저 도착해도 버리지 않기)", () => {
  it("상대 설명(answer/offer)이 오기 전에 온 후보는 모아 뒀다가 나중에 넣는다", async () => {
    const added: string[] = [];
    const q = new IceQueue(async (c) => void added.push(c.candidate ?? ""));
    await q.add({ candidate: "a" });
    await q.add({ candidate: "b" });
    expect(added).toEqual([]);
    await q.ready();
    expect(added).toEqual(["a", "b"]);
    await q.add({ candidate: "c" });
    expect(added).toEqual(["a", "b", "c"]);
  });

  it("같은 후보가 두 번 와도 한 번만 넣는다", async () => {
    const added: string[] = [];
    const q = new IceQueue(async (c) => void added.push(c.candidate ?? ""));
    await q.ready();
    await q.add({ candidate: "a", sdpMid: "0" });
    await q.add({ candidate: "a", sdpMid: "0" });
    expect(added).toEqual(["a"]);
  });

  it("넣다가 실패해도 다음 후보는 계속 넣는다", async () => {
    const added: string[] = [];
    const q = new IceQueue(async (c) => {
      if (c.candidate === "bad") throw new Error("x");
      added.push(c.candidate ?? "");
    });
    await q.ready();
    await q.add({ candidate: "bad" });
    await q.add({ candidate: "ok" });
    expect(added).toEqual(["ok"]);
  });
});
