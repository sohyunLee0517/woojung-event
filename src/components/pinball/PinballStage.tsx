"use client";

import { useEffect, useRef } from "react";
import { allDone, BALL_R, BAR_T, createSim, DT, FINISH_Y, H, obstacleSeg, step, W, type Sim } from "@/lib/pinball/logic";
import { advancePlayback, catchUpSeconds } from "@/lib/pinball/playback";

/** 전체 재생 속도 (화면만 느리게, 결과는 그대로) */
const PLAYBACK = 0.7;

export type PinballPlayer = { id: string; name: string; emoji: string; color: string };

// 핀볼 판. 시드 하나로 모든 폰이 같은 장면을 그린다.
// 화면은 항상 "내 구슬"을 따라간다.
// 내가 1등 후보면 결승 직전 확대 + 슬로모션,
// 아니면 슬로모션 없이 1등 장면을 동그란 작은 창으로 띄워 준다. 1등이 들어온 뒤 나머지는 같은 속도로 들어온다.
export default function PinballStage({
  players,
  meId,
  seed,
  startedAtMs = null,
  onDone,
}: {
  players: PinballPlayer[];
  meId: string;
  seed: number;
  /** 게임이 시작한 시각 (이 기기 시계 기준). 화면이 늦게 뜬 폰은 그만큼 앞에서 시작해 다른 폰과 맞춘다 */
  startedAtMs?: number | null;
  onDone: (order: string[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const byId = new Map(players.map((p) => [p.id, p]));
    const sim: Sim = createSim(
      players.map((p) => p.id),
      seed,
    );

    // 늦게 뜬 화면은 시작 시각부터 흐른 만큼 먼저 굴려 둔다
    for (let n = Math.floor(catchUpSeconds(startedAtMs, Date.now(), PLAYBACK) / DT); n > 0 && !allDone(sim); n--) step(sim);

    const cam = { x: W / 2, y: 0, zoom: 1, speed: 1 };
    let acc = 0;
    let last = performance.now();
    let winnerAt = 0; // 1등이 들어온 실제 시각
    let endedAt = 0;
    let raf = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
    }
    resize();
    window.addEventListener("resize", resize);

    const pip = { x: W / 2, y: FINISH_Y, zoom: 3.2, alpha: 0 };

    function frame(now: number) {
      const elapsed = (now - last) / 1000; // 실제로 흐른 시간 (물리는 이만큼 진행)
      const real = Math.min(0.05, elapsed); // 카메라 움직임용 (튀지 않게)
      last = now;

      const running = sim.balls.filter((b) => !b.done);
      const leader = running.reduce((m, b) => (b.y > m.y ? b : m), running[0] ?? sim.balls[0]);
      const winner = sim.order[0] ? sim.balls.find((b) => b.id === sim.order[0])! : null;
      const me = sim.balls.find((b) => b.id === meId) ?? leader;
      const climax = !winner && leader.y > FINISH_Y - 230; // 1등 결승 직전
      if (winner && !winnerAt) winnerAt = now;
      const holding = !!winner && now - winnerAt < 1300; // 1등 들어온 순간 잠깐 붙잡기
      const star = winner ?? leader;
      const starIsMe = star.id === me.id;

      // 시간: 내가 1등 후보일 때만 결승 직전 슬로모션 + 골인 순간 거의 정지. 아니면 원래 속도
      const tSpeed = starIsMe && climax ? 0.18 : starIsMe && holding ? 0.05 : 1;

      // 큰 화면: 내 구슬. 내가 1등 후보면 확대
      let tZoom = 1;
      let fx = me.x;
      let fy = me.done ? FINISH_Y - 120 : me.y + 60;
      if ((climax || holding) && starIsMe) {
        tZoom = 2.6;
        fx = star.x;
        fy = holding ? FINISH_Y : star.y + 20;
      }
      const k = 1 - Math.pow(0.0005, real); // 부드럽게 따라가기
      cam.zoom += (tZoom - cam.zoom) * k;
      cam.speed += (tSpeed - cam.speed) * Math.min(1, k * 1.6);
      cam.x += (fx - cam.x) * k;
      cam.y += (fy - cam.y) * k;

      // 동그란 작은 창: 내가 1등 후보가 아닐 때 1등 장면
      const showPip = (climax || holding) && !starIsMe;
      pip.x += (star.x - pip.x) * Math.min(1, k * 2);
      pip.y += ((holding ? FINISH_Y : star.y + 10) - pip.y) * Math.min(1, k * 2);
      pip.alpha += ((showPip ? 1 : 0) - pip.alpha) * Math.min(1, k * 1.5);

      // ── 물리 진행 ──
      // 프레임 수가 아니라 흐른 시간만큼 간다 → 주사율(120·60Hz)이나 폰 성능과 상관없이 같은 속도
      const adv = advancePlayback(acc, elapsed, cam.speed * PLAYBACK);
      acc = adv.acc;
      for (let n = adv.steps; n > 0 && !allDone(sim); n--) {
        step(sim);
        sampleTrails();
      }
      if (allDone(sim) && !endedAt) endedAt = now;
      if (endedAt && now - endedAt > 700) {
        doneRef.current(sim.order);
        return;
      }

      render(winner?.id ?? null, climax && starIsMe, holding);
      raf = requestAnimationFrame(frame);
    }

    // 구슬 꼬리(네온 잔상) — 그리기 전용, 결과에는 영향 없음
    const trails = new Map<string, { x: number; y: number }[]>();

    function glow(color: string, blur: number) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    }

    // 꼬리는 프레임마다가 아니라 물리 2걸음(1/60초)마다 한 점 → 주사율이 달라도 길이가 같다
    function sampleTrails() {
      if (sim.tick % 2 !== 0) return;
      for (const b of sim.balls) {
        const tr = trails.get(b.id) ?? [];
        if (!b.done) {
          tr.push({ x: b.x, y: b.y });
          if (tr.length > 14) tr.shift();
        } else if (tr.length) tr.shift();
        trails.set(b.id, tr);
      }
    }

    function render(winnerId: string | null, climax: boolean, holding: boolean) {
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#04030a";
      ctx.fillRect(0, 0, cw, ch);
      drawWorld(cam, 0, 0, cw, ch, winnerId);

      if (climax) {
        const v = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.2, cw / 2, ch / 2, ch * 0.75);
        v.addColorStop(0, "rgba(0,0,0,0)");
        v.addColorStop(1, "rgba(20,0,30,.75)");
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, cw, ch);
        glow("#ff2bd6", 24);
        ctx.fillStyle = "#ffd6f6";
        ctx.font = `900 ${Math.round(cw / 13)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("두근두근…", cw / 2, ch * 0.08);
        ctx.shadowBlur = 0;
      }

      // 동그란 창 (1등 장면)
      if (pip.alpha > 0.02) {
        const r = cw * 0.26;
        const px = cw - r - cw * 0.05;
        const py = ch * 0.17 + r;
        ctx.save();
        ctx.globalAlpha = pip.alpha;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = "#04030a";
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
        drawWorld(pip, px - r, py - r, r * 2, r * 2, winnerId);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = pip.alpha;
        glow("#ff2bd6", 22);
        ctx.strokeStyle = "#ff2bd6";
        ctx.lineWidth = cw * 0.012;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();
        glow("#00f0ff", 14);
        ctx.fillStyle = "#c9fbff";
        ctx.font = `900 ${Math.round(cw / 26)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(holding ? "👑 1등 골인!" : "🔥 1등 다툼", px, py + r + cw * 0.05);
        ctx.restore();
      }
    }

    function drawWorld(c: { x: number; y: number; zoom: number }, rx: number, ry: number, rw: number, rh: number, winnerId: string | null) {
      const cw = rw;
      const ch = rh;
      const base = canvas.width / W;
      const s = base * c.zoom;
      const viewW = cw / s;
      const viewH = ch / s;
      const cx = Math.max(viewW / 2, Math.min(W - viewW / 2, c.x));
      const cy = Math.max(viewH / 2, Math.min(H - viewH / 2, c.y));
      const t = performance.now() / 1000;

      ctx.setTransform(s, 0, 0, s, rx + cw / 2 - cx * s, ry + ch / 2 - cy * s);

      // 바닥: 어두운 보라 + 네온 격자
      ctx.fillStyle = "#07051a";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(140,80,255,.13)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 32) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      for (let y = 0; y <= H; y += 32) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();

      // 테두리
      glow("#ff2bd6", 14);
      ctx.strokeStyle = "#ff2bd6";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

      // 결승선
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 4));
      const fg = ctx.createLinearGradient(0, 0, W, 0);
      fg.addColorStop(0, "#00f0ff");
      fg.addColorStop(0.5, "#ff2bd6");
      fg.addColorStop(1, "#00f0ff");
      glow("#ff2bd6", 20 * pulse);
      ctx.strokeStyle = fg;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, FINISH_Y);
      ctx.lineTo(W, FINISH_Y);
      ctx.stroke();
      glow("#00f0ff", 16);
      ctx.fillStyle = "#c9fbff";
      ctx.font = "italic 900 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FINISH", W / 2, FINISH_Y + 34);

      // 핀
      for (const p of sim.pins) {
        ctx.beginPath();
        if (p.bumper) {
          glow("#ff2bd6", 16);
          ctx.strokeStyle = "#ff7be8";
          ctx.lineWidth = 3;
          ctx.arc(p.x, p.y, p.r - 1.5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          glow("#00f0ff", 8);
          ctx.fillStyle = "#bff9ff";
          ctx.arc(p.x, p.y, p.r - 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 장애물
      ctx.lineCap = "round";
      for (const o of sim.obstacles) {
        const g = obstacleSeg(o);
        const col = o.kind === "spin" ? "#b6ff00" : o.kind === "slide" ? "#00f0ff" : "#ff2bd6";
        glow(col, 18);
        ctx.strokeStyle = col;
        ctx.lineWidth = BAR_T * 2;
        ctx.beginPath();
        ctx.moveTo(g.x1, g.y1);
        ctx.lineTo(g.x2, g.y2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.85)";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (o.kind === "spin") {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(o.cx, o.cy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 구슬 꼬리
      for (const b of sim.balls) {
        const tr = trails.get(b.id) ?? [];
        const col = byId.get(b.id)!.color;
        ctx.shadowBlur = 0;
        tr.forEach((q, i) => {
          ctx.globalAlpha = (i / tr.length) * 0.45;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(q.x, q.y, BALL_R * (0.35 + (0.6 * i) / tr.length), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      // 구슬
      for (const b of sim.balls) {
        const p = byId.get(b.id)!;
        const isWin = b.id === winnerId;
        glow(isWin ? "#fff" : p.color, isWin ? 26 : 14);
        ctx.fillStyle = "#0a0614";
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.font = "10px sans-serif";
        ctx.fillText(p.emoji, b.x, b.y + 1);
        glow(p.color, 8);
        ctx.font = "bold 8px sans-serif";
        ctx.fillStyle = isWin ? "#fff6a8" : "#fff";
        ctx.fillText(isWin ? `👑 ${p.name}` : p.name, b.x, b.y - BALL_R - 7);
      }
      ctx.shadowBlur = 0;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [players, seed, meId]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", borderRadius: 16, boxShadow: "0 0 24px rgba(255,43,214,.35)" }} />;
}
