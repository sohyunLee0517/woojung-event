"use client";

// 확정 전 자동 테스트 실행기 (브라우저 전용).
// 화면 밖에 격리 iframe 두 개(나·연습 친구)를 띄우고, 두 화면의 가상 시계를 한 걸음(0.1초)씩 같이 움직이며 끝까지 돌린 뒤 판정한다.
// 걸음 사이에 게임이 보낸 메시지(ukiki.send)는 다음 걸음 전에 두 화면 모두에게 전달한다 → 시간을 빨리 감아도 메시지가 제때 도착한다.
import { buildGameDocument, parseKitMessage, type KitPlayer } from "@/lib/game-maker/kit";
import {
  evaluateSmoke,
  SMOKE_REAL_LIMIT_MS,
  SMOKE_STALL_MS,
  SMOKE_STEP_MS,
  SMOKE_VIRTUAL_LIMIT_MS,
  type SmokeObservation,
  type SmokeResult,
} from "@/lib/game-maker/smoke";
import { GAME_FRAME_SRC, loadGameDocument } from "./frame-shell";

const PLAYERS: KitPlayer[] = [
  { id: "me", name: "나", emoji: "🐵" },
  { id: "friend", name: "연습 친구", emoji: "🐰" },
];

type Frame = { win: Window; id: string; obs: SmokeObservation; loaded: boolean };

export function runSmokeTest(html: string): Promise<SmokeResult> {
  return new Promise((resolve) => {
    const seed = Math.floor(Math.random() * 2147483647) || 1;
    const frames: Frame[] = [];
    const stops: (() => void)[] = [];
    let vt = 0; // 지금 걸음의 가상 시각
    let waiting = new Set<Window>();
    let stepSentAt = Date.now();
    let started = false;
    let done = false;
    let seq = 0;
    const outbox: { from: string; data: unknown }[] = [];

    const box = document.createElement("div");
    box.setAttribute("aria-hidden", "true");
    box.style.cssText = "position:fixed;left:-10000px;top:0;width:390px;height:720px;overflow:hidden;pointer-events:none";
    document.body.appendChild(box);

    const byWin = (w: Window | null) => frames.find((f) => f.win === w);
    const allDone = () => frames.some((f) => f.obs.ended) || frames.every((f) => f.obs.scored);

    const finish = (stalled: Window[] = []) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearInterval(watch);
      clearTimeout(hardStop);
      stops.forEach((s) => s());
      box.remove();
      resolve(evaluateSmoke(frames.map((f) => ({ ...f.obs, stalled: f.obs.stalled || stalled.includes(f.win) }))));
    };

    // 다음 걸음: 모은 메시지를 모두에게 전달하고, 두 시계를 한 걸음 앞으로
    const tick = new MessageChannel();
    tick.port1.onmessage = () => {
      if (done) return;
      for (const m of outbox.splice(0)) {
        seq += 1;
        for (const f of frames) f.win.postMessage({ __ukiki: true, type: "event", from: m.from, data: m.data, seq }, "*");
      }
      if (allDone()) return void setTimeout(() => finish(), 50);
      if (vt >= SMOKE_VIRTUAL_LIMIT_MS) return finish();
      vt += SMOKE_STEP_MS;
      waiting = new Set(frames.map((f) => f.win));
      stepSentAt = Date.now();
      for (const f of frames) f.win.postMessage({ __ukikiTestCmd: "advance", to: vt }, "*");
    };
    const nextStep = () => tick.port2.postMessage(0);

    const onMessage = (ev: MessageEvent) => {
      const f = byWin(ev.source as Window | null);
      if (!f) return;
      const d = ev.data as { __ukikiTest?: boolean; type?: string; data?: unknown } | null;
      if (d && d.__ukikiTest) {
        if (d.type === "error") {
          f.obs.errors.push(String(d.data).slice(0, 200));
        } else if (d.type === "used") {
          if (d.data === "players") f.obs.usedPlayers = true;
          else f.obs.usedKitIO = true;
        } else if (d.type === "loaded") {
          f.loaded = true;
          if (!started && frames.length === PLAYERS.length && frames.every((x) => x.loaded)) {
            started = true;
            nextStep();
          }
        } else if (d.type === "at") {
          f.obs.virtualMs = Number(d.data) || 0;
          waiting.delete(f.win);
          if (waiting.size === 0) nextStep();
        }
        return;
      }
      const m = parseKitMessage(ev.data);
      if (!m || m.type === "ready") return;
      f.obs.usedKitIO = true;
      if (m.type === "send") outbox.push({ from: f.id, data: m.data });
      if (m.type === "score") f.obs.scored = true;
      if (m.type === "end") f.obs.ended = true;
    };
    window.addEventListener("message", onMessage);

    for (const p of PLAYERS) {
      const el = document.createElement("iframe");
      el.setAttribute("sandbox", "allow-scripts");
      el.style.cssText = "border:0;width:390px;height:720px;display:block";
      const doc = buildGameDocument(html, { mode: "preview", me: p.id, players: PLAYERS, seed }, { test: true });
      stops.push(loadGameDocument(el, doc));
      el.src = GAME_FRAME_SRC;
      box.appendChild(el);
      if (el.contentWindow) {
        frames.push({
          win: el.contentWindow,
          id: p.id,
          loaded: false,
          obs: { errors: [], ended: false, scored: false, usedPlayers: false, usedKitIO: false, virtualMs: 0, stalled: false },
        });
      }
    }

    // 한 걸음 응답이 오래 안 오면(끝없는 반복 등) 멈춘 것. 처음부터 안 열리면 그것도 멈춘 것
    const loadDeadline = Date.now() + 10_000;
    const watch = setInterval(() => {
      if (!started && Date.now() > loadDeadline) return finish(frames.filter((f) => !f.loaded).map((f) => f.win));
      if (started && waiting.size > 0 && Date.now() - stepSentAt > SMOKE_STALL_MS) finish([...waiting]);
    }, 500);
    const hardStop = setTimeout(() => finish(), SMOKE_REAL_LIMIT_MS);
  });
}
