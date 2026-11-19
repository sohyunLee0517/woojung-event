import { afterAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { getFlags, setFlag } from "./features";

// 피처 토글 저장 (실제 DB). 실제 게임 스위치는 건드리지 않게 테스트 전용 키를 쓴다.
const hasDb = !!process.env.DATABASE_URL;
const K1 = "test-flag-a";
const K2 = "test-flag-b";

describe.skipIf(!hasDb)("피처 토글 (실제 DB)", () => {
  afterAll(async () => {
    await getSql()`delete from uk_feature_flags where key = any(${[K1, K2]})`;
  });

  it("한 번도 정하지 않은 키는 켜져 있다", async () => {
    expect(await getFlags([K1, K2])).toEqual({ [K1]: true, [K2]: true });
  });

  it("끄면 꺼지고, 다시 켜면 켜진다 (누가 바꿨는지도 남긴다)", async () => {
    await setFlag(K1, false, "test-admin");
    expect(await getFlags([K1, K2])).toEqual({ [K1]: false, [K2]: true });
    const rows = (await getSql()`select updated_by from uk_feature_flags where key = ${K1}`) as { updated_by: string }[];
    expect(rows[0].updated_by).toBe("test-admin");
    await setFlag(K1, true, "test-admin");
    expect((await getFlags([K1]))[K1]).toBe(true);
  });
});
