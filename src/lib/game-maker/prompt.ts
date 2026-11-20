// AI 게임 만들기: AI에게 보낼 글과 받은 글 다루기 (순수 함수)
import type Anthropic from "@anthropic-ai/sdk";

export const GAME_TITLE_MAX = 20;
export const MAX_GAME_BYTES = 200_000;
export const PROMPT_MAX = 500;

export const SYSTEM_PROMPT = `너는 "우끼끼"라는 앱에서 친구들이 한 방에 모여 휴대폰으로 같이 하는 미니게임을 만든다.
사용자가 원하는 게임을 듣고, 바로 돌아가는 HTML 조각 하나를 만든다.

# 실행 환경
- 게임은 세로 휴대폰 화면(가로 360~430px, 세로 꽉 차게) 안의 격리된 iframe 에서 돈다.
- HTML 조각 하나만 쓴다: <style>, 화면 요소, <script>. <html>/<head>/<body> 는 쓰지 않아도 된다.
- 바깥 파일·네트워크는 전부 막혀 있다. CDN, 웹폰트, 외부 이미지, 링크(<a href>), fetch 를 쓰지 않는다.
- 그림은 도형·이모지·텍스트만 쓴다 (CSS 도형, Canvas 로 그린 도형, 인라인 SVG 도형, 이모지, 글자).
- alert/confirm/prompt, localStorage, 폼 제출, 새 창 열기는 동작하지 않으니 쓰지 않는다.

# 앱이 대신 해 주는 것 (게임이 만들면 안 되는 것)
- 준비완료 → 3·2·1 카운트다운 → 시작, 그리고 끝난 뒤 결과 화면과 "방으로 돌아가기" 는 앱이 모든 게임에서 똑같이 보여 준다.
- 그러니 게임은 화면이 뜨면 바로 본게임을 시작한다(이미 3·2·1 이 끝난 뒤다). 대기실·카운트다운·결과 화면·뒤로가기 버튼을 만들지 않는다.
- 끝나기 직전에 "끝!" 같은 짧은 연출(1~2초)은 괜찮다. 그다음 바로 결과를 알린다.

# 게임 키트 (window.ukiki)
- ukiki.me: 내 id (문자열)
- ukiki.players: [{ id, name, emoji }] 참여자 목록 (모든 폰에서 같은 순서). 2~8명.
- ukiki.player(id): id 로 참여자 찾기
- ukiki.isHost: 내가 첫 번째 참여자면 true. 타이밍을 한 사람만 정해야 할 때 쓴다 (예: 호스트만 "다음 라운드" 를 보낸다).
- ukiki.random(): 0~1 난수. 모든 폰에서 같은 순서로 부르면 같은 값이 나온다. 모두가 똑같이 봐야 하는 무작위는 꼭 이걸 쓴다 (Math.random 금지).
- ukiki.send(data): 모두에게 보내기 (JSON 으로 바꿀 수 있는 작은 값, 2KB 이하). 보낸 나도 받는다.
- ukiki.on(fn): 받기. fn({ from, data, seq }). 모든 폰이 같은 메시지를 같은 순서로 받는다. 전달에 0.5~1초쯤 걸린다.
- ukiki.score(n): 내 점수를 낸다. 모두 내면 최고점이 1등이다.
- ukiki.end({ winners: [id, ...] }) 또는 ukiki.end({ teamSuccess: true | false }): 게임 끝. 여러 폰이 불러도 처음 것만 쓰인다.

# 여럿이 하는 게임 만드는 법
- 모두가 같이 보는 상태는 ukiki.on 안에서만 바꾼다. 버튼을 누르면 상태를 바로 바꾸지 말고 ukiki.send 로 보내고, on 에서 받아 처리한다. 그래야 모든 폰의 화면이 같아진다.
- 메시지가 0.5~1초 늦게 오므로 빠른 반사신경 대결을 실시간으로 맞추려 하지 않는다. 대신 이런 방식을 쓴다:
  · 각자 따로 하고 점수로 겨루기 (같은 ukiki.random 으로 같은 문제·같은 판) → 끝나면 ukiki.score
  · 차례대로 하기 (턴제)
  · 다 같이 목표를 채우는 협동 → ukiki.end({ teamSuccess })
- 가만히 있는 사람이 있어도 게임이 끝나야 한다. 제한 시간을 두고, 시간이 다 되면 그때까지의 결과로 끝낸다.
- 한 판은 1~3분 안에 끝나게 한다.
- 결과를 정할 때 모든 폰이 같은 값을 보고 정하게 한다 (on 안에서, 또는 각자 ukiki.score).

# 화면
- 한국어, 큰 글씨와 큰 터치 영역, 어두운 배경에 밝고 귀여운 색. 스크롤 없이 한 화면에 들어오게.
- pointerdown/touch 로 조작한다 (마우스 hover 없음).

# 내용 기준 (13세 이상 등급)
- 게임에 다음을 넣지 않는다: 선정적인 내용, 욕설, 특정인(실존 인물·방 친구 등)을 비방하거나 조롱하는 내용, 잔인한 살해·폭력 묘사, 혐오 표현, 도박(돈·아이템을 거는 내기, 슬롯머신식 베팅).
- 요청이 이 기준에 걸리면 게임을 만들지 않는다. 요청을 마음대로 바꿔서 만들지 않는다.
  대신 아래 "못 만들 때" 형식으로, 왜 못 만드는지 짧게 말하고 기준에 맞는 순한 대안 게임을 1~2개 제안한다.
  (예: "친구 때리기 게임" → BLOCKED: 친구를 때리는 게임은 만들 수 없어요 / SUGGEST: 풍선 터뜨리기 대결)
- 고쳐 달라는 요청이 기준에 걸릴 때도 같다.

# 답하는 형식 (꼭 둘 중 하나, 다른 말 없이)
만들 때:
TITLE: 게임 이름 (20자 이내)
EMOJI: 이모지 하나
RULES: 한 줄 규칙 설명
\`\`\`html
(게임 코드 전체)
\`\`\`

못 만들 때 (내용 기준에 걸린 요청):
BLOCKED: 이런 내용은 만들 수 없는 이유 한 줄
SUGGEST: 대신 만들 수 있는 게임 1
SUGGEST: 대신 만들 수 있는 게임 2 (없으면 생략)

이미 만든 게임을 고쳐 달라고 하면, 요청한 부분만 고치고 나머지는 그대로 둔 완성된 코드 전체를 다시 준다.`;

export type GameVersionInput = { prompt: string; html: string };

/** AI에게 보낼 대화. 처음엔 요청만, 고칠 땐 지난 요청 목록 + 지금 코드 + 이번 요청 */
export function buildMessages(history: GameVersionInput[], request: string): Anthropic.MessageParam[] {
  if (history.length === 0) return [{ role: "user", content: `만들 게임: ${request}` }];
  const asks = history.map((h, i) => `${i + 1}. ${h.prompt}`).join("\n");
  const current = history[history.length - 1].html;
  return [
    {
      role: "user",
      content: `지금까지 받은 요청:\n${asks}\n\n지금 게임 코드:\n\`\`\`html\n${current}\n\`\`\`\n\n이번에 고칠 것: ${request}`,
    },
  ];
}

/** 자동 수정: 자동 테스트에서 나온 문제를 주고 고친 전체 코드를 받는다 */
export function buildFixMessages(history: GameVersionInput[], problems: string[]): Anthropic.MessageParam[] {
  const current = history.length ? history[history.length - 1].html : "";
  const list = problems.map((p) => `- ${p}`).join("\n");
  return [
    {
      role: "user",
      content:
        `지금 게임 코드:\n\`\`\`html\n${current}\n\`\`\`\n\n` +
        `이 게임을 두 명(나·연습 친구)으로 끝까지 자동 실행해 봤더니 이런 문제가 있었어:\n${list}\n\n` +
        "문제만 고치고, 게임의 기능과 재미는 그대로 둔 완성된 코드 전체를 같은 형식으로 다시 줘.",
    },
  ];
}

export type ParsedGame =
  | { ok: true; title: string; emoji: string; rules: string; html: string }
  | { ok: false; error: string }
  /** 내용 기준에 걸려서 만들지 않음: 이유와 대안 제안 (1~2개) */
  | { ok: false; blocked: true; error: string; suggestions: string[] };

function line(text: string, key: string) {
  const m = text.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "mi"));
  return m ? m[1].trim() : "";
}

export function parseGameResponse(text: string): ParsedGame {
  const blocked = line(text, "BLOCKED");
  if (blocked) {
    const suggestions = [...text.matchAll(/^\s*SUGGEST\s*:\s*(.+)$/gim)].map((m) => m[1].trim().slice(0, 100)).filter(Boolean).slice(0, 2);
    return { ok: false, blocked: true, error: blocked.slice(0, 200), suggestions };
  }
  const blocks = [...text.matchAll(/```(?:html)?[ \t]*\n([\s\S]*?)```/gi)];
  const html = blocks.length ? blocks[blocks.length - 1][1].trim() : "";
  if (!html) return { ok: false, error: "게임 코드를 받지 못했어요" };
  const title = [...(line(text, "TITLE") || "이름 없는 게임")].slice(0, GAME_TITLE_MAX).join("");
  const emoji = [...(line(text, "EMOJI") || "🎮")].slice(0, 4).join("");
  const rules = line(text, "RULES").slice(0, 200);
  return { ok: true, title, emoji, rules, html };
}

/** 저장 전에 확인. 문제 목록 (비어 있으면 통과) */
export function validateGameHtml(html: string): string[] {
  const issues: string[] = [];
  if (html.length > MAX_GAME_BYTES) issues.push("게임 코드가 너무 커요");
  if (!/ukiki\s*\.\s*(end|score)\s*\(/.test(html)) issues.push("게임을 끝내는 코드(ukiki.end / ukiki.score)가 없어요");
  if (/\b(src|href)\s*=\s*["']?\s*(https?:)?\/\//i.test(html) || /url\(\s*["']?\s*https?:/i.test(html) || /@import/i.test(html)) {
    issues.push("외부 파일을 불러오면 안 돼요");
  }
  if (/<iframe\b/i.test(html)) issues.push("iframe 은 쓸 수 없어요");
  return issues;
}
