import { describe, expect, it } from "vitest";
import { buildFixMessages, buildMessages, parseGameResponse, SYSTEM_PROMPT, validateGameHtml } from "./prompt";

const REPLY = [
  "TITLE: 바나나 받기",
  "EMOJI: 🍌",
  "RULES: 떨어지는 바나나를 가장 많이 받은 사람이 1등!",
  "```html",
  "<div id=app></div>",
  "<script>ukiki.on(()=>{}); setTimeout(()=>ukiki.score(3), 1000)</script>",
  "```",
].join("\n");

describe("AI 응답 읽기", () => {
  it("제목·이모지·규칙·HTML 을 꺼낸다", () => {
    expect(parseGameResponse(REPLY)).toEqual({
      ok: true,
      title: "바나나 받기",
      emoji: "🍌",
      rules: "떨어지는 바나나를 가장 많이 받은 사람이 1등!",
      html: "<div id=app></div>\n<script>ukiki.on(()=>{}); setTimeout(()=>ukiki.score(3), 1000)</script>",
    });
  });

  it("못 만드는 요청이면 이유와 대안 1~2개를 꺼낸다", () => {
    const r = parseGameResponse("BLOCKED: 친구를 놀리는 게임은 만들 수 없어요\nSUGGEST: 다 같이 웃긴 표정 따라 하기\nSUGGEST: 친구 칭찬 릴레이\nSUGGEST: 세 번째는 버린다");
    expect(r).toEqual({
      ok: false,
      blocked: true,
      error: "친구를 놀리는 게임은 만들 수 없어요",
      suggestions: ["다 같이 웃긴 표정 따라 하기", "친구 칭찬 릴레이"],
    });
  });

  it("HTML 블록이 없으면 실패", () => {
    expect(parseGameResponse("TITLE: x\n그냥 글")).toEqual({ ok: false, error: "게임 코드를 받지 못했어요" });
  });

  it("제목이 없으면 기본 이름, 너무 길면 자른다", () => {
    const r = parseGameResponse("```html\n<script>ukiki.end({teamSuccess:true})</script>\n```");
    expect(r.ok && r.title).toBe("이름 없는 게임");
    const long = parseGameResponse(`TITLE: ${"가".repeat(50)}\n\`\`\`html\n<script>ukiki.end({})</script>\n\`\`\``);
    expect(long.ok && [...long.title].length).toBe(20);
  });
});

describe("게임 코드 검사", () => {
  it("끝내는 코드(ukiki.end 또는 ukiki.score)가 있어야 한다", () => {
    expect(validateGameHtml("<script>alert(1)</script>")).toEqual(["게임을 끝내는 코드(ukiki.end / ukiki.score)가 없어요"]);
    expect(validateGameHtml("<script>ukiki.end({teamSuccess:true})</script>")).toEqual([]);
  });

  it("외부 파일·iframe 은 안 된다", () => {
    expect(validateGameHtml('<script src="https://cdn.x/a.js"></script><script>ukiki.score(1)</script>')).toContain("외부 파일을 불러오면 안 돼요");
    expect(validateGameHtml("<iframe></iframe><script>ukiki.score(1)</script>")).toContain("iframe 은 쓸 수 없어요");
  });

  it("너무 크면 안 된다 (200KB)", () => {
    expect(validateGameHtml(`<script>ukiki.score(1)</script>${"x".repeat(200_001)}`)).toContain("게임 코드가 너무 커요");
  });
});

describe("AI 에게 보낼 대화", () => {
  it("시스템 프롬프트는 키트 사용법과 공통 흐름(준비·3·2·1·결과는 앱이 한다)을 알려 준다", () => {
    for (const word of ["ukiki.players", "ukiki.me", "ukiki.send", "ukiki.on", "ukiki.end", "ukiki.score", "ukiki.random", "3·2·1"]) {
      expect(SYSTEM_PROMPT).toContain(word);
    }
  });

  it("13세 이상 기준에 걸리면 마음대로 바꾸지 말고, 만들지 않고 이유와 대안을 말한다", () => {
    for (const word of ["13세", "선정", "욕설", "특정인", "비방", "조롱", "잔인", "혐오", "도박", "BLOCKED:", "SUGGEST:", "마음대로 바꿔서 만들지 않는다"]) {
      expect(SYSTEM_PROMPT).toContain(word);
    }
    expect(SYSTEM_PROMPT).not.toContain("순한 버전으로 바꿔서 만든다");
  });

  it("외부 이미지·링크 없이 도형·이모지·텍스트만", () => {
    expect(SYSTEM_PROMPT).toContain("도형·이모지·텍스트");
    expect(SYSTEM_PROMPT).toContain("링크");
  });

  it("처음 만들 때는 요청 하나", () => {
    expect(buildMessages([], "공 피하기 게임")).toEqual([{ role: "user", content: "만들 게임: 공 피하기 게임" }]);
  });

  it("고칠 때는 지금 코드와 지난 요청을 함께 보낸다", () => {
    const msgs = buildMessages(
      [
        { prompt: "공 피하기", html: "<p>v1</p>" },
        { prompt: "더 빠르게", html: "<p>v2</p>" },
      ],
      "공을 빨간색으로",
    );
    expect(msgs).toHaveLength(1);
    const text = msgs[0].content as string;
    expect(text).toContain("1. 공 피하기");
    expect(text).toContain("2. 더 빠르게");
    expect(text).toContain("<p>v2</p>");
    expect(text).not.toContain("<p>v1</p>");
    expect(text).toContain("이번에 고칠 것: 공을 빨간색으로");
  });

  it("자동 수정: 지금 코드와 테스트에서 나온 문제를 주고 고친 전체 코드를 받는다", () => {
    const msgs = buildFixMessages([{ prompt: "공 피하기", html: "<p>v1</p>" }], ["실행 중 오류: x", "게임이 멈췄어요"]);
    const text = msgs[0].content as string;
    expect(text).toContain("<p>v1</p>");
    expect(text).toContain("- 실행 중 오류: x");
    expect(text).toContain("- 게임이 멈췄어요");
    expect(text).toContain("기능과 재미는 그대로");
  });
});
