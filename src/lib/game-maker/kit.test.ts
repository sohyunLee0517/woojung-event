import { describe, expect, it } from "vitest";
import { buildGameDocument, GAME_CSP, parseKitMessage, stripDocumentShell } from "./kit";

const boot = {
  mode: "play" as const,
  me: "a",
  players: [
    { id: "a", name: "소현", emoji: "🐵" },
    { id: "b", name: "영한", emoji: "🐰" },
  ],
  seed: 42,
};

describe("게임 키트: 문서 만들기", () => {
  it("외부로 아무것도 못 나가게 CSP 를 맨 앞에 넣는다", () => {
    const doc = buildGameDocument("<p>hi</p>", boot);
    expect(doc).toContain(`<meta http-equiv="Content-Security-Policy" content="${GAME_CSP}">`);
    expect(GAME_CSP).toContain("default-src 'none'");
    expect(GAME_CSP).toContain("connect-src 'none'");
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(doc.indexOf("<p>hi</p>"));
  });

  it("키트(window.ukiki)와 부팅 정보가 게임 코드보다 먼저 실행된다", () => {
    const doc = buildGameDocument("<script>ukiki.end({teamSuccess:true})</script>", boot);
    expect(doc.indexOf("window.ukiki")).toBeLessThan(doc.indexOf("ukiki.end({teamSuccess:true})"));
    expect(doc).toContain('"seed":42');
  });

  it("이름에 </script> 가 있어도 부팅 스크립트가 깨지지 않는다", () => {
    const doc = buildGameDocument("<p>x</p>", { ...boot, players: [{ id: "a", name: "</script><b>", emoji: "🐵" }] });
    expect(doc).not.toContain("</script><b>");
  });

  it("AI가 문서 전체(<html><body>)를 줘도 껍데기는 벗기고 안쪽만 쓴다", () => {
    const inner = stripDocumentShell(
      '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>p{}</style></head><body class="x"><p>hi</p></body></html>',
    );
    expect(inner).toContain("<style>p{}</style>");
    expect(inner).toContain("<p>hi</p>");
    expect(inner).not.toMatch(/<\/?(html|body|head)\b/i);
    expect(inner).not.toMatch(/<!doctype/i);
  });
});

describe("게임 키트: 게임이 보낸 메시지 읽기", () => {
  it("send / end / score 만 받는다", () => {
    expect(parseKitMessage({ __ukiki: true, type: "send", data: { x: 1 } })).toEqual({ type: "send", data: { x: 1 } });
    expect(parseKitMessage({ __ukiki: true, type: "score", value: 12 })).toEqual({ type: "score", value: 12 });
    expect(parseKitMessage({ __ukiki: true, type: "end", result: { winners: ["a"], teamSuccess: false } })).toEqual({
      type: "end",
      result: { winners: ["a"], teamSuccess: false },
    });
    expect(parseKitMessage({ __ukiki: true, type: "ready" })).toEqual({ type: "ready" });
  });

  it("모르는 메시지·이상한 값은 버린다", () => {
    expect(parseKitMessage(null)).toBeNull();
    expect(parseKitMessage({ type: "send", data: 1 })).toBeNull();
    expect(parseKitMessage({ __ukiki: true, type: "navigate", url: "x" })).toBeNull();
    expect(parseKitMessage({ __ukiki: true, type: "score", value: "12" })).toBeNull();
    expect(parseKitMessage({ __ukiki: true, type: "score", value: Infinity })).toBeNull();
    expect(parseKitMessage({ __ukiki: true, type: "end", result: { winners: [1] } })).toEqual({ type: "end", result: { winners: [], teamSuccess: false } });
  });

  it("너무 큰 send 는 버린다 (2KB)", () => {
    expect(parseKitMessage({ __ukiki: true, type: "send", data: "x".repeat(3000) })).toBeNull();
  });
});
