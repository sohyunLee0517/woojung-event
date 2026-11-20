"use client";

// 게임 칸 열기.
// iOS 앱 웹뷰(react-native-webview)는 허용 목록에 없는 about:srcdoc 주소를 막아서 srcdoc iframe 이 비어 보인다.
// 그래서 먼저 우리 사이트의 빈 껍데기(/game-frame.html)를 sandbox iframe 으로 열고, 껍데기가 준비됐다고 알리면
// 게임 문서를 메시지로 넘긴다(껍데기가 document.write 로 띄운다).
// 껍데기가 응답하지 않는 환경이면 잠시 뒤 srcdoc 으로 바꾼다.
export const GAME_FRAME_SRC = "/game-frame.html";
const SHELL_WAIT_MS = 2000;

/** 게임 문서를 칸에 넣는다. 돌려준 함수를 부르면 기다리기를 그만둔다 */
export function loadGameDocument(frame: HTMLIFrameElement, doc: string): () => void {
  let done = false;
  const stop = () => {
    window.removeEventListener("message", onMessage);
    clearTimeout(timer);
  };
  const onMessage = (ev: MessageEvent) => {
    if (done || ev.source !== frame.contentWindow) return;
    const d = ev.data as { __ukikiShell?: string } | null;
    if (d?.__ukikiShell !== "ready") return;
    done = true;
    stop();
    frame.contentWindow?.postMessage({ __ukikiDoc: doc }, "*");
  };
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    stop();
    frame.removeAttribute("src");
    frame.srcdoc = doc;
  }, SHELL_WAIT_MS);
  window.addEventListener("message", onMessage);
  return stop;
}
