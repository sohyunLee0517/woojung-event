// 랜덤 핀볼: 시드 하나로 판과 구슬 움직임이 전부 정해진다.
// 서버는 시드만 정해 주면 되고, 모든 폰이 같은 시드로 돌리면 같은 장면·같은 순서가 나온다.
// (sin/cos 같은 기기마다 미세하게 다를 수 있는 함수는 쓰지 않는다. 사칙연산과 sqrt 만 사용)

export const W = 320; // 판 너비
export const H = 1500; // 판 높이
export const FINISH_Y = H - 70; // 결승선
export const BALL_R = 9;
export const PIN_R = 5;
export const DT = 1 / 120; // 고정 시간 간격(초)
const GRAVITY = 1300;
const BOUNCE = 0.55;
const MAX_TICKS = 120 * 90; // 90초 안에 다 못 들어오면 남은 사람은 위치 순서로

export type Pin = { x: number; y: number; r: number; bumper?: boolean };
export type Ball = { id: string; x: number; y: number; vx: number; vy: number; done: boolean };
/** 장애물: 회전 막대 / 좌우로 움직이는 막대 / 비스듬한 벽. 모두 굵기 있는 선분으로 처리 */
export type Obstacle =
  | { kind: "spin"; cx: number; cy: number; len: number; c: number; s: number; dir: 1 | -1 }
  | { kind: "slide"; bx: number; y: number; w: number; amp: number; period: number; phase: number; x: number; v: number }
  | { kind: "wall"; x1: number; y1: number; x2: number; y2: number };
export type Seg = { x1: number; y1: number; x2: number; y2: number };
export type Sim = { pins: Pin[]; obstacles: Obstacle[]; balls: Ball[]; order: string[]; tick: number; rand: () => number };

export const BAR_T = 4; // 막대 두께의 절반
// 회전 막대: 한 틱에 0.035 라디안. cos/sin 은 미리 계산한 상수 (기기마다 같은 값)
const ROT_C = 0.9993875475169615;
const ROT_S = 0.034992855440793245;
const SPIN_W = 0.035 / DT; // 초당 각속도
const BANDS = [330, 570, 820, 1060, 1290];

export function buildObstacles(rand: () => number): Obstacle[] {
  const kinds = ["spin2", "slide", "funnel", "bigspin", "slide2"];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const out: Obstacle[] = [];
  const spin = (cx: number, cy: number, len: number, dir: 1 | -1): Obstacle => ({ kind: "spin", cx, cy, len, c: 1, s: 0, dir });
  const slide = (y: number, w: number, phase: number): Obstacle => ({ kind: "slide", bx: W / 2, y, w, amp: W / 2 - w / 2 - 12, period: 240 + Math.floor(rand() * 120), phase, x: W / 2, v: 0 });
  kinds.forEach((k, i) => {
    const y = BANDS[i];
    if (k === "spin2") out.push(spin(85, y, 80, 1), spin(W - 85, y, 80, -1));
    if (k === "bigspin") out.push(spin(W / 2, y, 160, rand() < 0.5 ? 1 : -1));
    if (k === "slide") out.push(slide(y, 120, Math.floor(rand() * 300)));
    if (k === "slide2") {
      const ph = Math.floor(rand() * 300);
      out.push(slide(y - 25, 90, ph), slide(y + 25, 90, ph + 150));
    }
    if (k === "funnel") out.push({ kind: "wall", x1: 0, y1: y - 40, x2: 115, y2: y + 20 }, { kind: "wall", x1: W, y1: y - 40, x2: W - 115, y2: y + 20 });
  });
  return out;
}

/** 장애물의 지금 선분 (그리기용으로도 씀) */
export function obstacleSeg(o: Obstacle): Seg {
  if (o.kind === "spin") {
    const hx = (o.c * o.len) / 2;
    const hy = (o.s * o.len) / 2;
    return { x1: o.cx - hx, y1: o.cy - hy, x2: o.cx + hx, y2: o.cy + hy };
  }
  if (o.kind === "slide") return { x1: o.x - o.w / 2, y1: o.y, x2: o.x + o.w / 2, y2: o.y };
  return o;
}

function moveObstacles(sim: Sim) {
  for (const o of sim.obstacles) {
    if (o.kind === "spin") {
      const s = o.dir * ROT_S;
      const c = o.c * ROT_C - o.s * s;
      const sn = o.s * ROT_C + o.c * s;
      const n = Math.sqrt(c * c + sn * sn);
      o.c = c / n;
      o.s = sn / n;
    } else if (o.kind === "slide") {
      const u = ((sim.tick + o.phase) % o.period) / o.period;
      const tri = u < 0.5 ? 4 * u - 1 : 3 - 4 * u;
      o.x = o.bx + o.amp * tri;
      o.v = ((u < 0.5 ? 4 : -4) * o.amp) / (o.period * DT);
    }
  }
}

function collideObstacle(b: Ball, o: Obstacle, rand: () => number) {
  const g = obstacleSeg(o);
  const ex = g.x2 - g.x1;
  const ey = g.y2 - g.y1;
  const l2 = ex * ex + ey * ey;
  let t = ((b.x - g.x1) * ex + (b.y - g.y1) * ey) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = g.x1 + ex * t;
  const py = g.y1 + ey * t;
  const dx = b.x - px;
  const dy = b.y - py;
  const min = BALL_R + BAR_T;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min || d2 === 0) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  b.x = px + nx * min;
  b.y = py + ny * min;
  // 막대 표면 속도
  let sx = 0;
  let sy = 0;
  if (o.kind === "spin") {
    const w = o.dir * SPIN_W;
    sx = -w * (py - o.cy);
    sy = w * (px - o.cx);
  } else if (o.kind === "slide") sx = o.v;
  const rvx = b.vx - sx;
  const rvy = b.vy - sy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    b.vx = sx + rvx - (1 + BOUNCE) * vn * nx + (rand() - 0.5) * 30;
    b.vy = sy + rvy - (1 + BOUNCE) * vn * ny;
  }
}

/** 시드 고정 난수 (mulberry32) */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildPins(rand: () => number): Pin[] {
  const pins: Pin[] = [];
  const gap = 40;
  let row = 0;
  for (let y = 170; y < FINISH_Y - 90; y += 60, row++) {
    const off = row % 2 ? gap / 2 : 0;
    for (let x = 20 + off; x <= W - 20; x += gap) {
      // 핀을 군데군데 빼서 길이 매번 달라지게
      if (rand() < 0.28) continue;
      // 장애물 자리는 비워 둔다
      if (BANDS.some((b) => Math.abs(b - y) < 55)) continue;
      const bumper = rand() < 0.06;
      pins.push({ x: x + (rand() - 0.5) * 8, y: y + (rand() - 0.5) * 8, r: bumper ? 13 : PIN_R, bumper });
    }
  }
  return pins;
}

export function createSim(ids: string[], seed: number): Sim {
  const rand = seeded(seed);
  const pins = buildPins(rand);
  const obstacles = buildObstacles(rand);
  // 시작 위치도 섞는다
  const slots = ids.map((id) => ({ id, k: rand() })).sort((p, q) => p.k - q.k);
  const balls = slots.map(({ id }, i) => ({
    id,
    x: 30 + ((W - 60) * (i + 0.5)) / slots.length + (rand() - 0.5) * 10,
    y: 40 + rand() * 30,
    vx: (rand() - 0.5) * 60,
    vy: 0,
    done: false,
  }));
  return { pins, obstacles, balls, order: [], tick: 0, rand };
}

function collideCircle(b: Ball, cx: number, cy: number, r: number, kick: number, rand: () => number) {
  const dx = b.x - cx;
  const dy = b.y - cy;
  const min = BALL_R + r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min || d2 === 0) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  b.x = cx + nx * min;
  b.y = cy + ny * min;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + BOUNCE) * vn * nx;
    b.vy -= (1 + BOUNCE) * vn * ny;
    // 살짝 옆으로 흔들어 매번 결과가 달라지게
    b.vx += (rand() - 0.5) * 40;
    if (kick) {
      b.vx += nx * kick;
      b.vy += ny * kick;
    }
  }
}

/** 한 틱 진행 */
export function step(sim: Sim): void {
  const { balls, pins, rand } = sim;
  moveObstacles(sim);
  for (const b of balls) {
    if (b.done) continue;
    b.vy += GRAVITY * DT;
    b.vx *= 0.999;
    b.x += b.vx * DT;
    b.y += b.vy * DT;
    if (b.x < BALL_R) {
      b.x = BALL_R;
      b.vx = Math.abs(b.vx) * BOUNCE;
    }
    if (b.x > W - BALL_R) {
      b.x = W - BALL_R;
      b.vx = -Math.abs(b.vx) * BOUNCE;
    }
    for (const p of pins) {
      if (Math.abs(p.y - b.y) > 20 || Math.abs(p.x - b.x) > 20) continue;
      collideCircle(b, p.x, p.y, p.r, p.bumper ? 260 : 0, rand);
    }
    for (const o of sim.obstacles) collideObstacle(b, o, rand);
    // 핀 위에 멈춰 버리면 톡 쳐서 굴린다
    if (Math.abs(b.vx) + Math.abs(b.vy) < 30) b.vx += (rand() < 0.5 ? -1 : 1) * 80;
    if (b.y >= FINISH_Y) {
      b.done = true;
      sim.order.push(b.id);
    }
  }
  // 구슬끼리 부딪힘
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const c = balls[j];
      if (a.done || c.done) continue;
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = BALL_R * 2;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      c.x += nx * push;
      c.y += ny * push;
      const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = (-(1 + BOUNCE) * rel) / 2;
        a.vx -= imp * nx;
        a.vy -= imp * ny;
        c.vx += imp * nx;
        c.vy += imp * ny;
      }
    }
  }
  sim.tick++;
  if (sim.tick >= MAX_TICKS) {
    for (const b of [...balls].filter((x) => !x.done).sort((p, q) => q.y - p.y)) {
      b.done = true;
      sim.order.push(b.id);
    }
  }
}

export function allDone(sim: Sim): boolean {
  return sim.balls.every((b) => b.done);
}

/** 화면 없이 끝까지 돌려서 순서만 얻는다 (서버 검증·테스트용) */
export function simulateOrder(ids: string[], seed: number): string[] {
  const sim = createSim(ids, seed);
  while (!allDone(sim)) step(sim);
  return sim.order;
}
