import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import KakaoLoginButton from "./KakaoLoginButton";

// 첫 화면(앱 안인지 확인하기 전)에 웹 로그인 버튼이 깔려 있으면,
// 앱에서 빨리 누른 사람이 카카오톡 대신 아이디 입력 화면으로 빠진다.
describe("KakaoLoginButton 첫 화면", () => {
  const html = renderToString(createElement(KakaoLoginButton, { next: "/", webLogin: async () => {} }));

  it("앱 안인지 확인하기 전에는 웹 로그인 폼을 그리지 않는다", () => {
    expect(html).not.toContain("<form");
  });

  it("확인하는 동안 버튼은 눌리지 않는다", () => {
    expect(html).toMatch(/<button[^>]*disabled/);
  });
});
