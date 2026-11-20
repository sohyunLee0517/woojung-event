// 모든 테스트 공통 준비.
// 게임 켜기/끄기는 운영 DB 의 실제 스위치라서, 테스트가 관리자 설정에 따라 깨지지 않게 기본은 모두 켜진 것으로 본다.
// (스위치 동작 자체는 game-switch.db.test.ts 가 자기 값으로 덮어써서 확인한다)
import { vi } from "vitest";

vi.mock("@/lib/ukiki/features", async (orig) => ({
  ...(await orig<typeof import("@/lib/ukiki/features")>()),
  enabledGames: vi.fn(async () => ({ fanfare: true, gacha: true, pirate: true, snack: true, pinball: true, ai: true })),
}));
