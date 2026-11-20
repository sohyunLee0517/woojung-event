// AI 게임 만들기·고치기.
//   start: 바나나 10개를 내고 '만드는 중'으로 표시 (바로 끝난다)
//   finish: AI를 불러 게임 코드를 받고 새 버전으로 저장 (1~3분). 실패하면 바나나를 돌려준다.
// API 라우트는 start 뒤에 after() 로 finish 를 뒤에서 돌린다. 화면은 상태를 다시 불러 결과를 본다.
import Anthropic from "@anthropic-ai/sdk";
import { getSql } from "@/lib/db";
import { refundBananas, spendBananas } from "@/lib/bananas/store";
import { PROMPT_COST } from "@/lib/bananas/rules";
import { buildFixMessages, buildMessages, parseGameResponse, PROMPT_MAX, SYSTEM_PROMPT, validateGameHtml } from "./prompt";
import { AUTOFIX_MAX } from "./smoke";
import { getAiGameForEdit, loadAiGame } from "./store";

export const GAME_MODEL = "claude-opus-5-5";

export type ModelCall = (system: string, messages: Anthropic.MessageParam[]) => Promise<string>;

export type StartPromptResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "not_found" | "busy" }
  | { ok: false; reason: "bananas"; balance: number; need: number };

export async function startGamePrompt(id: number, me: string, rawPrompt: string): Promise<StartPromptResult> {
  const prompt = rawPrompt.trim();
  if (!prompt || [...prompt].length > PROMPT_MAX) return { ok: false, reason: "invalid" };
  const game = await getAiGameForEdit(id, me);
  if (!game) return { ok: false, reason: "not_found" };
  if (game.pending) return { ok: false, reason: "busy" };

  const spent = await spendBananas(me, PROMPT_COST);
  if (!spent.ok) return { ok: false, reason: "bananas", balance: spent.balance, need: PROMPT_COST };

  const claimed = (await getSql()`
    update uk_ai_games set pending_prompt = ${prompt}, pending_ledger_id = ${spent.ledgerId}, pending_since = now(),
      last_error = null, last_suggestions = null, autofix_count = 0, pending_fix = null
    where id = ${id} and pending_prompt is null
    returning id
  `) as unknown[];
  if (claimed.length === 0) {
    await refundBananas(me, spent.ledgerId);
    return { ok: false, reason: "busy" };
  }
  return { ok: true };
}

export type AutoFixResult = { ok: true; attempt: number } | { ok: false; reason: "not_found" | "busy" | "not_latest" | "limit" };

/** 확정 전 자동 테스트에서 문제가 나왔을 때: AI가 고친 새 버전을 만든다 (바나나 없음, 사용자 프롬프트 한 번에 최대 3번) */
export async function startAutoFix(id: number, me: string, version: number, problems: string[]): Promise<AutoFixResult> {
  const game = await getAiGameForEdit(id, me);
  if (!game) return { ok: false, reason: "not_found" };
  if (game.pending) return { ok: false, reason: "busy" };
  if (game.versions.at(-1)?.version !== version) return { ok: false, reason: "not_latest" };
  if (game.autofixLeft <= 0) return { ok: false, reason: "limit" };
  const attempt = AUTOFIX_MAX - game.autofixLeft + 1;
  const fix = problems.slice(0, 10).map((p) => p.slice(0, 300));
  const claimed = (await getSql()`
    update uk_ai_games set autofix_count = autofix_count + 1, pending_fix = ${fix},
      pending_prompt = ${`🔧 자동 수정 (${attempt}/${AUTOFIX_MAX})`}, pending_ledger_id = null, pending_since = now(),
      last_error = null, last_suggestions = null
    where id = ${id} and pending_prompt is null and autofix_count < ${AUTOFIX_MAX}
    returning id
  `) as unknown[];
  return claimed.length ? { ok: true, attempt } : { ok: false, reason: "busy" };
}

/** 진짜 AI 호출 (Claude). 긴 코드를 받으니 스트리밍으로 받고, 안전 거절 시 다른 모델로 넘긴다 */
export const callClaude: ModelCall = async (system, messages) => {
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: GAME_MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    messages,
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("이 요청으로는 게임을 만들 수 없어요. 다른 게임으로 바꿔 볼까요?");
  if (msg.stop_reason === "max_tokens") throw new Error("게임이 너무 커서 다 만들지 못했어요. 조금 더 간단하게 바꿔 볼까요?");
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
};

function friendly(e: unknown) {
  if (e instanceof Anthropic.APIError) {
    if (e.status === 429 || e.status === 529) return "AI가 지금 바빠요. 잠시 뒤 다시 해 주세요.";
    if (e.status === 401) return "AI 연결 설정에 문제가 있어요. 관리자에게 알려 주세요.";
    return "AI와 연결하지 못했어요. 잠시 뒤 다시 해 주세요.";
  }
  return e instanceof Error && e.message ? e.message : "게임을 만들지 못했어요.";
}

export async function finishGamePrompt(id: number, me: string, callModel: ModelCall = callClaude): Promise<void> {
  const g = await loadAiGame(id);
  if (!g || g.creator_kakao_id !== me || !g.pending_prompt) return;
  const prompt = g.pending_prompt;
  const ledgerId = g.pending_ledger_id === null ? null : Number(g.pending_ledger_id);
  const sql = getSql();
  try {
    const history = (await sql`
      select prompt, html from uk_ai_game_versions where ai_game_id = ${id} order by version
    `) as { prompt: string; html: string }[];
    const fix = g.pending_fix;
    const text = await callModel(SYSTEM_PROMPT, fix ? buildFixMessages(history, fix) : buildMessages(history, prompt));
    const parsed = parseGameResponse(text);
    if (!parsed.ok && "blocked" in parsed) {
      // 내용 기준(13세)에 걸림: 만들지 않고 이유·대안만 남기고 바나나는 돌려준다
      await sql`
        update uk_ai_games set pending_prompt = null, pending_ledger_id = null, pending_since = null, pending_fix = null,
          last_error = ${`이런 내용은 만들 수 없어요. ${parsed.error}`}, last_suggestions = ${parsed.suggestions}
        where id = ${id}
      `;
      if (ledgerId !== null) await refundBananas(me, ledgerId);
      return;
    }
    if (!parsed.ok) throw new Error(parsed.error);
    const issues = validateGameHtml(parsed.html);
    if (issues.length) throw new Error(`만든 게임에 문제가 있어요: ${issues.join(", ")}`);
    await sql`
      with v as (
        insert into uk_ai_game_versions (ai_game_id, version, prompt, html, title, emoji, rules)
        select ${id}, coalesce(max(version), 0) + 1, ${prompt}, ${parsed.html}, ${parsed.title}, ${parsed.emoji}, ${parsed.rules}
        from uk_ai_game_versions where ai_game_id = ${id}
        returning version
      )
      update uk_ai_games set pending_prompt = null, pending_ledger_id = null, pending_since = null, last_error = null,
        pending_fix = null, updated_at = now(),
        title = case when status = 'draft' then ${parsed.title} else title end,
        emoji = case when status = 'draft' then ${parsed.emoji} else emoji end
      where id = ${id}
    `;
  } catch (e) {
    console.error("[game-maker] 생성 실패", e);
    await sql`
      update uk_ai_games set pending_prompt = null, pending_ledger_id = null, pending_since = null, pending_fix = null,
        last_error = ${ledgerId !== null ? `${friendly(e)} 바나나는 돌려드렸어요.` : friendly(e)}
      where id = ${id}
    `;
    if (ledgerId !== null) await refundBananas(me, ledgerId);
  }
}
