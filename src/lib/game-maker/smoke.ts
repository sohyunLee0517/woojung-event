// 확정할 때 하는 자동 테스트 (만든 사람 화면 안의 격리 칸에서, 시간을 빨리 감아 끝까지 돌려 본다).
// 여기는 판정 규칙과 iframe 안에 넣을 스크립트(문자열)만 둔다. 실제로 돌리는 건 components/game-maker/smoke-runner.ts.

/** 이 가상 시간 안에 결과(ukiki.end / 모두의 ukiki.score)가 나와야 한다 */
export const SMOKE_VIRTUAL_LIMIT_MS = 6 * 60_000;
/** 실제 시간으로 이만큼 지나면 테스트를 멈춘다 */
export const SMOKE_REAL_LIMIT_MS = 45_000;
/** 실제 시간으로 이만큼 한 걸음 응답이 없으면 멈춘 것으로 본다 */
export const SMOKE_STALL_MS = 5_000;
/** 테스트가 두 화면의 시계를 한 번에 움직이는 걸음 (가상 시간) */
export const SMOKE_STEP_MS = 100;
/** 확정 한 번에 AI 자동 수정은 최대 이만큼 */
export const AUTOFIX_MAX = 3;

/** 한 화면(참여자 한 명)을 돌려 보며 본 것 */
export type SmokeObservation = {
  errors: string[];
  ended: boolean;
  scored: boolean;
  usedPlayers: boolean;
  /** ukiki.on / send / end / score 중 하나라도 */
  usedKitIO: boolean;
  virtualMs: number;
  stalled: boolean;
};

export type SmokeResult = { ok: boolean; problems: string[] };

export function evaluateSmoke(obs: SmokeObservation[]): SmokeResult {
  const problems: string[] = [];
  const errors = [...new Set(obs.flatMap((o) => o.errors))].slice(0, 5);
  for (const e of errors) problems.push(`실행 중 오류: ${e}`);
  if (obs.some((o) => o.stalled)) problems.push("게임이 멈췄어요 (끝없는 반복이 있는지 확인해 주세요)");
  const finished = obs.some((o) => o.ended) || (obs.length > 0 && obs.every((o) => o.scored));
  if (!finished) {
    problems.push(`게임이 ${SMOKE_VIRTUAL_LIMIT_MS / 60_000}분 안에 끝나지 않아요 (ukiki.end 나 모두의 ukiki.score 가 없어요)`);
  }
  if (!obs.some((o) => o.usedPlayers)) problems.push("참여자 목록(ukiki.players)을 쓰지 않아요");
  if (!obs.some((o) => o.usedKitIO)) problems.push("게임 키트(ukiki.on / send / end / score)를 쓰지 않아요");
  return { ok: problems.length === 0, problems };
}

export function problemsForAI(problems: string[]): string {
  return problems.map((p) => `- ${p}`).join("\n");
}

// ── iframe 안 스크립트 (테스트 모드에서만 넣는다) ──
// 1) 시간 빨리 감기: setTimeout/setInterval/requestAnimationFrame/Date.now/performance.now 를 가상 시계로 바꾼다.
//    시계는 스스로 가지 않고, 테스트(부모)가 { advance, to } 를 보낼 때마다 그 시각까지만 간다.
//    두 화면이 한 걸음씩 같이 가고, 걸음 사이에 보낸 메시지는 다음 걸음 전에 모두에게 전달된다 (실제처럼 메시지가 제때 도착).
// 2) 오류 수집. 3) 화면 아무 곳이나 가끔 눌러 본다(버튼 처리 오류 찾기).
export const SMOKE_HARNESS_SCRIPT = `(function(){
  window.__UKIKI_TEST__ = true;
  var RealDate = Date, base = RealDate.now(), T = { now: 0, seq: 0, timers: [] };
  function report(type, data){ parent.postMessage({ __ukikiTest: true, type: type, data: data }, "*"); }
  function vnow(){ return base + T.now; }
  function VDate(){
    if (!(this instanceof VDate)) return new RealDate(vnow()).toString();
    var a = [].slice.call(arguments);
    return a.length ? new (Function.prototype.bind.apply(RealDate, [null].concat(a)))() : new RealDate(vnow());
  }
  VDate.prototype = RealDate.prototype; VDate.now = vnow; VDate.UTC = RealDate.UTC; VDate.parse = RealDate.parse;
  window.Date = VDate;
  try { Object.defineProperty(performance, "now", { value: function(){ return T.now; }, configurable: true }); } catch (e) {}
  function add(fn, delay, repeat, args){
    var id = ++T.seq, d = Math.max(0, Number(delay) || 0);
    T.timers.push({ id: id, at: T.now + d, delay: Math.max(repeat ? 4 : 0, d), fn: fn, repeat: repeat, args: args });
    return id;
  }
  function clear(id){ T.timers = T.timers.filter(function(t){ return t.id !== id; }); }
  window.setTimeout = function(fn, d){ return add(fn, d, false, [].slice.call(arguments, 2)); };
  window.setInterval = function(fn, d){ return add(fn, d, true, [].slice.call(arguments, 2)); };
  window.clearTimeout = clear; window.clearInterval = clear;
  window.requestAnimationFrame = function(fn){ return add(function(){ fn(T.now); }, 33, false, []); };
  window.cancelAnimationFrame = clear;
  function msg(e){ return (e && (e.message || e.reason && e.reason.message)) || String(e && e.reason || e); }
  window.addEventListener("error", function(e){ report("error", msg(e)); });
  window.addEventListener("unhandledrejection", function(e){ report("error", "Promise 오류: " + msg(e)); });
  function tapSomething(){
    var els = document.body ? document.body.querySelectorAll("*") : [];
    var pool = [];
    for (var i = 0; i < els.length; i++) { var r = els[i].getBoundingClientRect(); if (r.width > 0 && r.height > 0 && els[i].tagName !== "SCRIPT" && els[i].tagName !== "STYLE") pool.push(els[i]); }
    var el = pool.length ? pool[Math.floor(Math.random() * pool.length)] : document.body;
    if (!el) return;
    var r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, pointerType: "touch" };
    try {
      el.dispatchEvent(new PointerEvent("pointerdown", o));
      el.dispatchEvent(new MouseEvent("mousedown", o));
      el.dispatchEvent(new PointerEvent("pointerup", o));
      el.dispatchEvent(new MouseEvent("mouseup", o));
      el.dispatchEvent(new MouseEvent("click", o));
    } catch (e) { report("error", msg(e)); }
  }
  add(tapSomething, 400, true, []);
  function advance(to){
    var guard = 0;
    for (;;) {
      T.timers.sort(function(a, b){ return a.at - b.at || a.id - b.id; });
      var t = T.timers[0];
      if (!t || t.at > to || ++guard > 20000) break;
      T.timers.shift();
      if (t.at > T.now) T.now = t.at;
      if (t.repeat) { t.at = T.now + t.delay; T.timers.push(t); }
      try { if (typeof t.fn === "function") t.fn.apply(window, t.args); } catch (err) { report("error", msg(err)); }
    }
    T.now = to;
    report("at", to);
  }
  window.addEventListener("message", function(e){
    if (e.source !== parent || !e.data || e.data.__ukikiTestCmd !== "advance") return;
    advance(Number(e.data.to) || 0);
  });
  window.addEventListener("load", function(){ report("loaded", 0); });
})();`;

// 키트를 쓰는지 기록 (키트 다음, 게임 앞에 넣는다)
export const SMOKE_KIT_SPY_SCRIPT = `(function(){
  var k = window.ukiki, players = k.players, player = k.player, on = k.on, seen = {};
  function mark(n){ if (!seen[n]) { seen[n] = 1; parent.postMessage({ __ukikiTest: true, type: "used", data: n }, "*"); } }
  Object.defineProperty(k, "players", { get: function(){ mark("players"); return players; } });
  k.player = function(id){ mark("players"); return player(id); };
  k.on = function(fn){ mark("on"); return on(fn); };
})();`;
