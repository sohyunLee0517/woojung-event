import { describe, expect, it, vi } from "vitest";
import { cameraErrorMessage, openCameraWith } from "./camera";

const err = (name: string) => Object.assign(new Error(name), { name });

describe("cameraErrorMessage", () => {
  it("권한 거부", () => {
    expect(cameraErrorMessage(err("NotAllowedError"))).toContain("권한");
  });
  it("다른 앱/탭이 카메라를 쓰는 중 (NotReadableError)", () => {
    const m = cameraErrorMessage(err("NotReadableError"));
    expect(m).toContain("다른 앱");
    expect(m).toContain("시스템 설정");
  });
  it("카메라 없음", () => {
    expect(cameraErrorMessage(err("NotFoundError"))).toContain("찾을 수 없어요");
  });
  it("그 밖의 오류", () => {
    expect(cameraErrorMessage(err("Weird"))).toContain("켤 수 없어요");
  });
});

describe("openCameraWith (안 되면 더 단순한 설정으로 다시)", () => {
  const stream = { id: "s" } as unknown as MediaStream;

  it("처음 설정으로 되면 그대로", async () => {
    const gum = vi.fn().mockResolvedValue(stream);
    await expect(openCameraWith(gum)).resolves.toBe(stream);
    expect(gum).toHaveBeenCalledTimes(1);
  });

  it("장치를 못 열면(NotReadable/Overconstrained) 단순한 설정으로 다시 시도", async () => {
    const gum = vi.fn().mockRejectedValueOnce(err("NotReadableError")).mockResolvedValueOnce(stream);
    await expect(openCameraWith(gum)).resolves.toBe(stream);
    expect(gum).toHaveBeenCalledTimes(2);
    expect(gum.mock.calls[1][0]).toEqual({ video: true, audio: true });
  });

  it("마이크까지 안 되면 영상만이라도", async () => {
    const gum = vi
      .fn()
      .mockRejectedValueOnce(err("NotReadableError"))
      .mockRejectedValueOnce(err("NotReadableError"))
      .mockResolvedValueOnce(stream);
    await expect(openCameraWith(gum)).resolves.toBe(stream);
    expect(gum.mock.calls[2][0]).toEqual({ video: true, audio: false });
  });

  it("권한 거부는 다시 시도하지 않는다", async () => {
    const gum = vi.fn().mockRejectedValue(err("NotAllowedError"));
    await expect(openCameraWith(gum)).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(gum).toHaveBeenCalledTimes(1);
  });
});
