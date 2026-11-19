import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Toggle from "./Toggle";

// 공통 토글 스위치 (켜짐/꺼짐)
describe("Toggle", () => {
  const html = (props: Parameters<typeof Toggle>[0]) => renderToString(createElement(Toggle, props));

  it("스위치 역할과 켜짐 상태를 읽기 도구에 알려 준다", () => {
    const on = html({ checked: true, label: "생일 가챠" });
    expect(on).toContain('role="switch"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('aria-label="생일 가챠"');
    expect(html({ checked: false, label: "생일 가챠" })).toContain('aria-checked="false"');
  });

  it("폼 안에서는 제출 버튼으로, 그 밖에서는 일반 버튼으로 쓴다", () => {
    expect(html({ checked: true, label: "x", submit: true })).toContain('type="submit"');
    expect(html({ checked: true, label: "x" })).toContain('type="button"');
  });

  it("막혀 있으면 누를 수 없다", () => {
    expect(html({ checked: true, label: "x", disabled: true })).toMatch(/<button[^>]*disabled/);
  });
});
