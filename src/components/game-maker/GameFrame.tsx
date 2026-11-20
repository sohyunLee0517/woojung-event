"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildGameDocument, parseKitMessage, type KitBoot, type KitEvent, type KitMessage } from "@/lib/game-maker/kit";

// AI가 만든 게임을 격리된 iframe 에 띄우고, 게임 키트 메시지를 이어 준다.
//   events: 지금까지 받은 메시지 (뒤에 계속 붙는다). 새로 붙은 것만 게임에 넘긴다.
//   onMessage: 게임이 send / score / end 를 부르면
// 게임을 새로 시작하려면 key 를 바꿔서 다시 그린다.
export default function GameFrame({
  html,
  boot,
  events,
  onMessage,
  style,
}: {
  html: string;
  boot: KitBoot;
  events: KitEvent[];
  onMessage: (m: Exclude<KitMessage, { type: "ready" }>) => void;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const delivered = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // 처음 그릴 때의 게임·참여자로 고정 (폴링으로 값이 바뀌어도 게임이 다시 시작되지 않게)
  const doc = useMemo(() => buildGameDocument(html, boot), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (!ref.current || ev.source !== ref.current.contentWindow) return;
      const m = parseKitMessage(ev.data);
      if (!m) return;
      if (m.type === "ready") setReady(true);
      else onMessageRef.current(m);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const w = ref.current?.contentWindow;
    if (!w) return;
    while (delivered.current < events.length) {
      const e = events[delivered.current++];
      w.postMessage({ __ukiki: true, type: "event", from: e.from, data: e.data, seq: e.seq }, "*");
    }
  }, [ready, events]);

  return (
    <iframe
      ref={ref}
      title="게임"
      sandbox="allow-scripts"
      srcDoc={doc}
      style={{ border: 0, width: "100%", height: "100%", display: "block", background: "#0d0d14", borderRadius: 16, ...style }}
    />
  );
}
