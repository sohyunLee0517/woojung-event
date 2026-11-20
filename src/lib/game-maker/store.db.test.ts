import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { createRoom, enterRoom, listPastGames } from "@/lib/ukiki/rooms";
import { bananaBalance, grantBananas, myBananas } from "@/lib/bananas/store";
import { AI_GAMES_PER_ROOM, createAiGame, deleteAiGame, getAiGameForEdit, getMyDraft, listRoomAiGames, publishAiGame } from "./store";
import { finishGamePrompt, startGamePrompt } from "./generate";
import { createAiRound, endAiRound, getAiRoundState, joinAiRound, postAiEvent, setAiRoundReady, submitAiScore } from "./round-store";

// AI 게임 만들기 + 방에서 한 판 (실제 DB, AI 는 가짜)
const hasDb = !!process.env.DATABASE_URL;
const P = ["test-gm-a", "test-gm-b", "test-gm-out"];
const [A, B, OUT] = P;

const GOOD = "TITLE: 탭 대결\nEMOJI: 👆\nRULES: 많이 누르면 1등\n```html\n<button id=b>탭</button><script>ukiki.score(1)</script>\n```";
const fakeModel = (reply: string) => async () => reply;
const brokenModel = async () => {
  throw new Error("AI 오류");
};

async function startNow(id: number) {
  await getSql()`update uk_ai_rounds set started_at = now() - interval '1 second' where game_id = ${id}`;
}

describe.skipIf(!hasDb)("AI 게임 만들기 (실제 DB)", () => {
  let room = "";

  beforeAll(async () => {
    const sql = getSql();
    for (const p of P) await sql`insert into players (kakao_id, nickname) values (${p}, ${p}) on conflict do nothing`;
    await sql`delete from uk_banana_ledger where kakao_id = any(${P})`;
    await sql`delete from uk_banana_wallets where kakao_id = any(${P})`;
    const r = await createRoom(A, { name: "테스트 게임 만들기", visibility: "public" });
    if (!r.ok) throw new Error("방 실패");
    room = r.code;
    await enterRoom(room, B);
  });

  afterAll(async () => {
    const sql = getSql();
    await sql`delete from uk_rooms where owner_kakao_id = ${A}`;
    await sql`delete from uk_banana_ledger where kakao_id = any(${P})`;
    await sql`delete from uk_banana_wallets where kakao_id = any(${P})`;
    await sql`delete from players where kakao_id = any(${P})`;
  });

  let gameId = 0;

  it("방 멤버만 게임을 만들 수 있다", async () => {
    expect(await createAiGame(room, OUT)).toEqual({ ok: false, reason: "not_member" });
    const g = await createAiGame(room, A);
    if (!g.ok) throw new Error();
    gameId = g.id;
  });

  it("임시저장은 방마다 한 사람에 1개: 있으면 알려 주고, '새로 만들기'면 이전 것을 지우고 새로", async () => {
    expect(await getMyDraft(room, A)).toEqual({ id: gameId, versions: 0 });
    expect(await createAiGame(room, A)).toEqual({ ok: false, reason: "draft_exists", id: gameId });
    const again = await createAiGame(room, A, { replace: true });
    if (!again.ok) throw new Error();
    expect(again.id).not.toBe(gameId);
    expect(await getAiGameForEdit(gameId, A)).toBeNull();
    gameId = again.id;
    // 다른 사람은 따로 1개
    const b = await createAiGame(room, B);
    expect(b.ok).toBe(true);
    if (b.ok) await deleteAiGame(b.id, B);
  });

  it("바나나가 10개 안 되면 프롬프트를 못 돌린다", async () => {
    expect(await startGamePrompt(gameId, A, "탭 대결 게임")).toEqual({ ok: false, reason: "bananas", balance: 0, need: 10 });
  });

  it("바나나 10개를 내고 AI가 만들면 버전 1이 생긴다", async () => {
    await grantBananas(A, 25);
    const s = await startGamePrompt(gameId, A, "탭 대결 게임");
    expect(s).toEqual({ ok: true });
    expect(await bananaBalance(A)).toBe(15);
    expect((await getAiGameForEdit(gameId, A))?.pending).toEqual({ prompt: "탭 대결 게임" });
    // 기다리는 동안 또 누를 수 없다
    expect(await startGamePrompt(gameId, A, "또")).toEqual({ ok: false, reason: "busy" });

    await finishGamePrompt(gameId, A, fakeModel(GOOD));
    const g = await getAiGameForEdit(gameId, A);
    expect(g?.pending).toBeNull();
    expect(g?.versions.map((v) => [v.version, v.prompt, v.title, v.emoji])).toEqual([[1, "탭 대결 게임", "탭 대결", "👆"]]);
  });

  it("AI가 실패하면 바나나를 돌려주고 이유를 남긴다", async () => {
    await startGamePrompt(gameId, A, "더 재밌게");
    expect(await bananaBalance(A)).toBe(5);
    await finishGamePrompt(gameId, A, brokenModel);
    expect(await bananaBalance(A)).toBe(15);
    const g = await getAiGameForEdit(gameId, A);
    expect(g?.versions).toHaveLength(1);
    expect(g?.lastError).toBeTruthy();
  });

  it("13세 기준에 걸린 요청은 만들지 않고 이유·대안만 남기고, 바나나는 돌려준다", async () => {
    await startGamePrompt(gameId, A, "친구 놀리는 게임");
    await finishGamePrompt(gameId, A, fakeModel("BLOCKED: 친구를 놀리는 게임은 만들 수 없어요\nSUGGEST: 친구 칭찬 릴레이"));
    expect(await bananaBalance(A)).toBe(15);
    const g = await getAiGameForEdit(gameId, A);
    expect(g?.versions).toHaveLength(1);
    expect(g?.lastError).toBe("이런 내용은 만들 수 없어요. 친구를 놀리는 게임은 만들 수 없어요");
    expect(g?.suggestions).toEqual(["친구 칭찬 릴레이"]);
  });

  it("게임을 끝내는 코드가 없으면 실패로 보고 환불", async () => {
    await startGamePrompt(gameId, A, "끝 없는 게임");
    await finishGamePrompt(gameId, A, fakeModel("TITLE: x\n```html\n<p>끝이 없어요</p>\n```"));
    expect(await bananaBalance(A)).toBe(15);
    expect((await getAiGameForEdit(gameId, A))?.lastError).toContain("ukiki.end");
  });

  it("만든 사람만 고치고 확정할 수 있다. 확정 전에는 방 목록에 안 보인다", async () => {
    expect(await getAiGameForEdit(gameId, B)).toBeNull();
    expect(await publishAiGame(gameId, B, 1)).toEqual({ ok: false });
    expect((await listRoomAiGames(room, B))?.published).toEqual([]);
    expect(await publishAiGame(gameId, A, 1)).toEqual({ ok: true });
    const list = await listRoomAiGames(room, B);
    expect(list?.published.map((g) => [g.id, g.title, g.emoji])).toEqual([[gameId, "탭 대결", "👆"]]);
  });

  it("확정하면 임시저장이 비고, 확정한 게임은 더 고치거나 다시 확정할 수 없다", async () => {
    expect(await getMyDraft(room, A)).toBeNull();
    expect(await getAiGameForEdit(gameId, A)).toBeNull();
    expect(await startGamePrompt(gameId, A, "고쳐 줘")).toEqual({ ok: false, reason: "not_found" });
    expect(await publishAiGame(gameId, A, 1)).toEqual({ ok: false });
  });

  it("방에서 한 판: 공통 준비 → 시작 → 메시지는 모두 같은 순서 → 점수를 다 내면 최고점이 1등, 바나나 정산", async () => {
    expect((await createAiRound(room, OUT, gameId)).kind).toBe("not_member");
    const r = await createAiRound(room, A, gameId);
    if (r.kind !== "created") throw new Error(r.kind);
    await joinAiRound(room, r.id, B);
    const waiting = await getAiRoundState(room, r.id, A, 0);
    expect(waiting?.startedAt).toBeNull();
    expect(waiting?.html).toBeNull(); // 시작 전에는 게임 코드를 안 내려준다

    await setAiRoundReady(room, r.id, A, true);
    await setAiRoundReady(room, r.id, B, true);
    await startNow(r.id);

    const st = await getAiRoundState(room, r.id, A, 0);
    expect(st?.members).toEqual([A, B]);
    expect(st?.html).toContain("ukiki.score");
    expect(st?.title).toBe("탭 대결");

    await postAiEvent(room, r.id, A, { tap: 1 });
    await postAiEvent(room, r.id, B, { tap: 2 });
    expect(await postAiEvent(room, r.id, OUT, { tap: 3 })).toBe(false);
    const ev = (await getAiRoundState(room, r.id, B, 0))?.events ?? [];
    expect(ev.map((e) => [e.from, e.data])).toEqual([
      [A, { tap: 1 }],
      [B, { tap: 2 }],
    ]);
    const after = (await getAiRoundState(room, r.id, B, ev[0].seq))?.events ?? [];
    expect(after.map((e) => e.from)).toEqual([B]);

    await submitAiScore(room, r.id, A, 3);
    expect((await getAiRoundState(room, r.id, A, 0))?.result).toBeNull();
    await submitAiScore(room, r.id, B, 7);
    expect((await getAiRoundState(room, r.id, A, 0))?.result).toEqual({ winners: [B], teamSuccess: false });

    const a = await myBananas(A);
    const b = await myBananas(B);
    expect([a, b]).toEqual([15 + 1, 1 + 2]);

    const past = (await listPastGames(room, A))?.items.find((x) => x.id === r.id);
    expect(past?.type).toBe("ai");
    expect(past?.miniResult?.summary).toBe("👆 탭 대결 · 👑 test-gm-b");
  });

  it("팀 성공으로 끝내면 모두 승리. 끝난 뒤에는 결과가 바뀌지 않는다", async () => {
    const r = await createAiRound(room, B, gameId);
    if (r.kind !== "created") throw new Error(r.kind);
    await joinAiRound(room, r.id, A);
    await setAiRoundReady(room, r.id, A, true);
    await setAiRoundReady(room, r.id, B, true);
    await startNow(r.id);
    await endAiRound(room, r.id, A, { winners: [], teamSuccess: true });
    await endAiRound(room, r.id, B, { winners: [B], teamSuccess: false });
    expect((await getAiRoundState(room, r.id, A, 0))?.result).toEqual({ winners: [], teamSuccess: true });
  });

  it("방마다 AI 게임은 최대 10개. 꽉 차면 새로 만들 수 없다", async () => {
    expect(AI_GAMES_PER_ROOM).toBe(10);
    const sql = getSql();
    const extra = AI_GAMES_PER_ROOM - 1;
    for (let i = 0; i < extra; i++) {
      await sql`insert into uk_ai_games (room_code, creator_kakao_id, status, published_version) values (${room}, ${B}, 'published', 1)`;
    }
    expect(await createAiGame(room, B)).toEqual({ ok: false, reason: "full" });
    await sql`delete from uk_ai_games where room_code = ${room} and creator_kakao_id = ${B}`;
  });

  it("만든 사람만 지울 수 있다. 지워도 지난 게임 기록은 남는다", async () => {
    expect(await deleteAiGame(gameId, B)).toEqual({ ok: false });
    expect(await deleteAiGame(gameId, A)).toEqual({ ok: true });
    expect((await listRoomAiGames(room, A))?.published).toEqual([]);
    const past = (await listPastGames(room, A))?.items.filter((x) => x.type === "ai") ?? [];
    expect(past.length).toBeGreaterThan(0);
  });
});
