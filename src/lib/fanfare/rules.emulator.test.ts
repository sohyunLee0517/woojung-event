import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { increment, ref, remove, set, update } from "firebase/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

// Firebase 보안 규칙 테스트 (로컬 에뮬레이터). 실행: npm run test:rules
const EMU = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const G = "ukiki/fanfare/42";
const HOST = "kakao-host";
const A = "kakao-a";
const B = "kakao-b";
const OUT = "kakao-outsider";

let env: RulesTestEnvironment;

const db = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database();

async function seed(state: Record<string, unknown> = { status: "WAITING", temperature: 0 }) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), G), {
      meta: { hostId: HOST, members: { [HOST]: true, [A]: true, [B]: true } },
      state,
      taps: { [A]: 3, [B]: 5 },
    });
  });
}

const playing = { status: "PLAYING", temperature: 50, updatedAt: 1000, startedAt: 500, celebratedAt: null };

describe.skipIf(!EMU)("빵빠레 보안 규칙", () => {
  beforeAll(async () => {
    const [host, port] = (EMU as string).split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-ukiki",
      database: { host, port: Number(port), rules: readFileSync("database.rules.json", "utf8") },
    });
  });
  afterAll(() => env?.cleanup());
  beforeEach(async () => {
    await env.clearDatabase();
    await seed();
  });

  describe("로그인·방 멤버", () => {
    it("로그인 안 한 사람은 읽기도 쓰기도 못 한다", async () => {
      const { get } = await import("firebase/database");
      await assertFails(get(ref(db(), `${G}/state`)));
      await assertFails(set(ref(db(), `${G}/players/x`), { name: "x" }));
    });

    it("방 멤버가 아니면 로그인해도 못 읽는다", async () => {
      const { get } = await import("firebase/database");
      await assertFails(get(ref(db(OUT), `${G}/state`)));
    });

    it("방 멤버는 읽을 수 있다", async () => {
      const { get } = await import("firebase/database");
      await assertSucceeds(get(ref(db(A), `${G}/state`)));
    });

    it("다른 경로(예전 빵빠레 등)는 아무도 못 쓴다", async () => {
      await assertFails(set(ref(db(A), "woojung-event"), { status: "PLAYING" }));
    });

    it("meta(호스트·멤버 명단)는 서버만 쓸 수 있다", async () => {
      await assertFails(set(ref(db(A), `${G}/meta/hostId`), A));
      await assertFails(set(ref(db(HOST), `${G}/meta/members/${OUT}`), true));
    });
  });

  describe("참가자 표시", () => {
    it("내 자리만 쓸 수 있다", async () => {
      await assertSucceeds(set(ref(db(A), `${G}/players/${A}`), { name: "A", image: null, joinedAt: 1 }));
      await assertFails(set(ref(db(A), `${G}/players/${B}`), { name: "가짜 B" }));
      await assertSucceeds(remove(ref(db(A), `${G}/players/${A}`)));
    });
  });

  describe("탭 (정정당당)", () => {
    beforeEach(() => seed(playing));

    it("진행 중에 내 탭 수를 1씩 올릴 수 있다", async () => {
      await assertSucceeds(set(ref(db(A), `${G}/taps/${A}`), increment(1)));
    });

    it("남의 탭 수는 못 건드린다 — 호스트도 마찬가지", async () => {
      await assertFails(set(ref(db(A), `${G}/taps/${B}`), increment(1)));
      await assertFails(set(ref(db(HOST), `${G}/taps/${B}`), 999));
      await assertFails(set(ref(db(HOST), `${G}/taps/${A}`), 0));
    });

    it("한 번에 여러 탭을 올리거나 숫자를 직접 쓰면 막힌다", async () => {
      await assertFails(set(ref(db(A), `${G}/taps/${A}`), increment(5)));
      await assertFails(set(ref(db(A), `${G}/taps/${A}`), 100));
    });

    it("100도를 넘긴 마지막 탭도 내 탭 수에 들어간다 (축하 직후 5초 안)", async () => {
      await seed({ ...playing, status: "CELEBRATING", temperature: 100, celebratedAt: Date.now() });
      await assertSucceeds(set(ref(db(A), `${G}/taps/${A}`), increment(1)));
    });

    it("축하가 시작되고 한참 지난 뒤(순위 발표 중)에는 탭이 안 올라간다", async () => {
      await seed({ ...playing, status: "CELEBRATING", temperature: 100, celebratedAt: Date.now() - 60_000 });
      await assertFails(set(ref(db(A), `${G}/taps/${A}`), increment(1)));
    });

    it("진행 중이 아니면 탭이 안 올라간다", async () => {
      await seed({ status: "WAITING", temperature: 0 });
      await assertFails(set(ref(db(A), `${G}/taps/${A}`), increment(1)));
    });

    it("온도는 탭 한 번만큼(2.5도 이하)만 올릴 수 있다", async () => {
      await assertSucceeds(set(ref(db(A), `${G}/state`), { ...playing, temperature: 52.5, updatedAt: 2000 }));
      await seed(playing);
      await assertFails(set(ref(db(A), `${G}/state`), { ...playing, temperature: 99, updatedAt: 2000 }));
    });

    it("참가자가 게임을 시작 전으로 돌리거나 시작 시각을 바꿀 수 없다", async () => {
      await assertFails(set(ref(db(A), `${G}/state`), { status: "WAITING", temperature: 0 }));
      await assertFails(set(ref(db(A), `${G}/state`), { ...playing, startedAt: 9999 }));
    });

    it("100도에 닿는 탭이면 축하 단계로 넘길 수 있다", async () => {
      await seed({ ...playing, temperature: 98 });
      await assertSucceeds(
        set(ref(db(A), `${G}/state`), { ...playing, status: "CELEBRATING", temperature: 100, updatedAt: 2000, celebratedAt: 2000 }),
      );
    });

    it("멀었는데 참가자가 축하 단계로 넘기면 막힌다", async () => {
      await assertFails(
        set(ref(db(A), `${G}/state`), { ...playing, status: "CELEBRATING", temperature: 100, updatedAt: 2000, celebratedAt: 2000 }),
      );
    });
  });

  describe("호스트 조작", () => {
    const start = { status: "PLAYING", temperature: 0, updatedAt: 1, startedAt: 1, celebratedAt: null };
    const ready = async (opts: { camera: boolean; players: boolean }) => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const d = ctx.database();
        await set(ref(d, `${G}/host`), opts.camera ? { kakaoId: HOST, epoch: 1, online: true } : null);
        await set(ref(d, `${G}/players`), opts.players ? { [A]: { name: "A", image: null, joinedAt: 1 } } : null);
      });
    };

    it("게임 시작은 호스트만 (카메라 켜짐 + 친구 1명 이상)", async () => {
      await ready({ camera: true, players: true });
      await assertFails(set(ref(db(A), `${G}/state`), start));
      await assertSucceeds(set(ref(db(HOST), `${G}/state`), start));
    });

    it("카메라가 꺼져 있으면 호스트도 시작할 수 없다", async () => {
      await ready({ camera: false, players: true });
      await assertFails(set(ref(db(HOST), `${G}/state`), start));
    });

    it("친구가 한 명도 없으면(혼자면) 시작할 수 없다", async () => {
      await ready({ camera: true, players: false });
      await assertFails(set(ref(db(HOST), `${G}/state`), start));
    });

    it("호스트도 온도를 마음대로 정할 수는 없다", async () => {
      await assertFails(set(ref(db(HOST), `${G}/state`), { status: "PLAYING", temperature: 80, updatedAt: 1, startedAt: 1 }));
    });

    it("바로 공개는 없다: 호스트도 진행 중에 축하 단계로 건너뛸 수 없다", async () => {
      await seed(playing);
      const reveal = { ...playing, status: "CELEBRATING", temperature: 100, updatedAt: 2000, celebratedAt: 2000 };
      await assertFails(set(ref(db(HOST), `${G}/state`), reveal));
    });

    it("처음부터 다시는 없다: 호스트도 진행 중인 게임을 대기로 되돌릴 수 없다", async () => {
      await seed(playing);
      const reset = { status: "WAITING", temperature: 0, updatedAt: null, startedAt: null, celebratedAt: null };
      await assertFails(set(ref(db(HOST), `${G}/state`), reset));
    });

    it("이미 시작한 게임을 다시 시작할 수 없다", async () => {
      await seed(playing);
      await ready({ camera: true, players: true });
      await assertFails(set(ref(db(HOST), `${G}/state`), { status: "PLAYING", temperature: 0, updatedAt: 9, startedAt: 9 }));
    });

    it("호스트 접속 정보(카메라 세대 번호)는 호스트만 쓴다", async () => {
      await assertSucceeds(set(ref(db(HOST), `${G}/host`), { kakaoId: HOST, epoch: 1, online: true }));
      await assertFails(set(ref(db(A), `${G}/host`), { kakaoId: A, epoch: 2, online: true }));
    });
  });

  describe("영상 연결 정보", () => {
    it("친구는 자기 이름으로 시작하는 칸에만 쓴다", async () => {
      await assertSucceeds(set(ref(db(A), `${G}/rtc/1/${A}-abc/joined`), true));
      await assertFails(set(ref(db(A), `${G}/rtc/1/${B}-abc/joined`), true));
    });

    it("호스트는 친구 칸에 offer 를 쓸 수 있다", async () => {
      await assertSucceeds(set(ref(db(HOST), `${G}/rtc/1/${A}-abc/offer`), { type: "offer", sdp: "x" }));
    });
  });
});
