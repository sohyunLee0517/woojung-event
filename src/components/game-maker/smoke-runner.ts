"use client";

// 확정 전 자동 테스트 실행기 (브라우저 전용).
// 화면 밖에 격리 iframe 두 개(나·연습 친구)를 띄우고 시간을 빨리 감아 끝까지 돌린 뒤 판정한다.
import { buildGameDocument, parseKitMessage, type KitPlayer } from "@/lib/game-maker/kit";
import { GAME_FRAME_SRC, loadGameDocument } from "./frame-shell";
import { evaluateSmoke, SMOKE_REAL_LIMIT_MS, SMOKE_STALL_MS, type SmokeObservation, type SmokeResult } from "@/lib/game-maker/smoke";

const PLAYERS: KitPlayer[] = [
  { id: "me", name: "나", emoji: "🐵" },
  { id: "friend", name: "연습 친구", emoji: "🐰" },
];

export function runSmokeTest(html: string): Promise<SmokeResult> {
  return new Promise((resolve) => {
    const seed = Math.floor(Math.random() * 2147483647) || 1;
    const obs = new Map<Window, SmokeObservation & { lastTickAt: number }>();
    const frames: HTMLIFrameElement[] = [];
    const ready = new Set<Window>();
    let seq = 0;
    let done = false;

    const box = document.createElement("div");
    box.setAttribute("aria-hidden", "true");
    box.style.cssText = "position:fixed;left:-10000px;top:0;width:390px;height:720px;overflow:hidden;pointer-events:none";
    document.body.appendChild(box);

    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearInterval(watch);
      clearTimeout(hardStop);
      const now = Date.now();
      const list = [...obs.values()].map((o) => ({ ...o, stalled: o.stalled || (!o.ended && !o.scored && now - o.lastTickAt > SMOKE_STALL_MS) }));
      stops.forEach((s) => s());
      box.remove();
      resolve(evaluateSmoke(list.map(({ lastTickAt: _t, ...o }) => o)));
    };

    const allDone = () => {
      const list = [...obs.values()];
      return list.length === PLAYERS.length && (list.some((o) => o.ended) || list.every((o) => o.scored));
    };

    const broadcast = (from: string, data: unknown) => {
      seq += 1;
      for (const w of ready) w.postMessage({ __ukiki: true, type: "event", from, data, seq }, "*");
    };

    const onMessage = (ev: MessageEvent) => {
      const w = ev.source as Window | null;
      if (!w || !obs.has(w)) return;
      const o = obs.get(w)!;
      const d = ev.data as { __ukikiTest?: boolean; type?: string; data?: unknown } | null;
      if (d && d.__ukikiTest) {
        if (d.type === "error") {
          const text = String(d.data).replace(/\(줄 (\d+)\)/, (_m, n) => `(게임 코드 ${Math.max(1, Number(n) - lineOffset)}번째 줄)`);
          o.errors.push(text.slice(0, 200));
        }
        if (d.type === "tick") {
          o.virtualMs = Number(d.data) || 0;
          o.lastTickAt = Date.now();
        }
        if (d.type === "used") {
          if (d.data === "players") o.usedPlayers = true;
          else o.usedKitIO = true;
        }
        if (d.type === "limit") o.virtualMs = Number(d.data) || 0;
        return;
      }
      const m = parseKitMessage(ev.data);
      if (!m) return;
      if (m.type === "ready") ready.add(w);
      else {
        o.usedKitIO = true;
        if (m.type === "send") setTimeout(() => broadcast(idOf.get(w) ?? "me", m.data), 50);
        if (m.type === "score") o.scored = true;
        if (m.type === "end") o.ended = true;
        if (allDone()) setTimeout(finish, 300); // 끝난 직후 오류도 잡게 잠깐 더
      }
    };
    window.addEventListener("message", onMessage);

    const idOf = new Map<Window, string>();
    const stops: (() => void)[] = [];
    // 오류 줄 번호를 AI가 쓴 게임 코드 기준으로 (앞에 넣은 키트·테스트 스크립트 줄 수만큼 뺀다)
    let lineOffset = 0;
    for (const p of PLAYERS) {
      const f = document.createElement("iframe");
      f.setAttribute("sandbox", "allow-scripts");
      f.style.cssText = "border:0;width:390px;height:720px;display:block";
      const doc = buildGameDocument(html, { mode: "preview", me: p.id, players: PLAYERS, seed }, { test: true });
      lineOffset = doc.slice(0, doc.indexOf("</head><body>") + "</head><body>".length).split("\n").length - 1;
      stops.push(loadGameDocument(f, doc));
      f.src = GAME_FRAME_SRC;
      box.appendChild(f);
      frames.push(f);
      const w = f.contentWindow;
      if (w) {
        idOf.set(w, p.id);
        obs.set(w, { errors: [], ended: false, scored: false, usedPlayers: false, usedKitIO: false, virtualMs: 0, stalled: false, lastTickAt: Date.now() });
      }
    }

    // 시계가 멈추거나, 가상 시간이 다 되거나, 실제 시간이 너무 오래 걸리면 끝
    const watch = setInterval(() => {
      const list = [...obs.values()];
      const now = Date.now();
      if (list.some((o) => !o.ended && !o.scored && now - o.lastTickAt > SMOKE_STALL_MS)) finish();
      else if (list.every((o) => o.ended || o.scored || o.virtualMs >= 6 * 60_000)) finish();
    }, 500);
    const hardStop = setTimeout(finish, SMOKE_REAL_LIMIT_MS);
  });
}
