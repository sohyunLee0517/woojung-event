// 게임 키트: AI가 만든 게임과 앱이 주고받는 약속.
//
// AI가 만든 게임은 sandbox iframe(allow-scripts 만) 안에서 돈다. 로그인·쿠키·우리 서버에 손댈 수 없고,
// CSP 로 바깥과의 통신도 막는다. 게임이 쓸 수 있는 건 아래 window.ukiki 하나뿐이다.
//
//   ukiki.me / ukiki.players / ukiki.seed / ukiki.random()   누가 하는지, 모두 같은 난수
//   ukiki.send(data)   모두에게 보내기 (보낸 나도 받는다. 모두 같은 순서로 받는다)
//   ukiki.on(fn)       받기: fn({ from, data, seq })
//   ukiki.score(n)     내 점수 내기 (모두 내면 최고점이 1등)
//   ukiki.end({ winners, teamSuccess })   게임 끝 (승자 또는 팀 성공)
//
// 준비완료 → 3·2·1 → 결과 → 방으로 돌아가기는 앱이 모든 게임에서 똑같이 한다. 게임은 '본게임'만 그린다.
// 이 파일은 순수 함수만 둔다 (서버·브라우저 어디서나 쓴다).

export type KitPlayer = { id: string; name: string; emoji: string };
export type KitBoot = { mode: "play" | "preview"; me: string; players: KitPlayer[]; seed: number };
export type KitEndResult = { winners: string[]; teamSuccess: boolean };

/** 게임 → 앱 */
export type KitMessage =
  | { type: "ready" }
  | { type: "send"; data: unknown }
  | { type: "score"; value: number }
  | { type: "end"; result: KitEndResult };

/** 앱 → 게임 */
export type KitEvent = { from: string; data: unknown; seq: number };

export const MAX_SEND_BYTES = 2048;

export const GAME_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "frame-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

const BASE_CSS =
  "html,body{margin:0;height:100%;overflow:hidden;background:#0d0d14;color:#fff;" +
  "font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;" +
  "-webkit-user-select:none;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}" +
  "*{box-sizing:border-box}";

// iframe 안에서 도는 키트 (일반 자바스크립트)
const KIT_SCRIPT = `(function(){
  var B = window.__UKIKI_BOOT__;
  var handlers = [], queue = [], ended = false;
  function post(m){ m.__ukiki = true; parent.postMessage(m, "*"); }
  var s = (B.seed >>> 0) || 1;
  function random(){ s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function deliver(e){ for (var i = 0; i < handlers.length; i++) { try { handlers[i](e); } catch (err) { console.error(err); } } }
  window.ukiki = {
    me: B.me,
    players: B.players,
    seed: B.seed,
    mode: B.mode,
    isHost: B.players.length > 0 && B.players[0].id === B.me,
    random: random,
    player: function(id){ for (var i = 0; i < B.players.length; i++) if (B.players[i].id === id) return B.players[i]; return null; },
    send: function(data){ if (!ended) post({ type: "send", data: data === undefined ? null : data }); },
    on: function(fn){ handlers.push(fn); var q = queue; queue = []; for (var i = 0; i < q.length; i++) { try { fn(q[i]); } catch (err) { console.error(err); } } },
    score: function(n){ if (!ended) post({ type: "score", value: Number(n) }); },
    end: function(r){ if (ended) return; ended = true; r = r || {}; post({ type: "end", result: { winners: r.winners || [], teamSuccess: r.teamSuccess === true } }); }
  };
  window.addEventListener("message", function(ev){
    if (ev.source !== parent) return;
    var m = ev.data;
    if (!m || m.__ukiki !== true || m.type !== "event") return;
    var e = { from: m.from, data: m.data, seq: m.seq };
    if (handlers.length === 0) queue.push(e); else deliver(e);
  });
  post({ type: "ready" });
})();`;

/** AI가 문서 전체를 줘도 <html>/<head>/<body> 껍데기는 벗긴다 (CSP·키트를 우리가 맨 앞에 두기 위해) */
export function stripDocumentShell(html: string): string {
  return html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?(html|head|body)\b[^>]*>/gi, "")
    .trim();
}

function safeJson(v: unknown) {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** iframe srcdoc 로 넣을 완성 문서: CSP → 기본 스타일 → 부팅 정보·키트 → 게임 */
export function buildGameDocument(gameHtml: string, boot: KitBoot): string {
  return [
    "<!doctype html><html><head>",
    `<meta http-equiv="Content-Security-Policy" content="${GAME_CSP}">`,
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">',
    `<style>${BASE_CSS}</style>`,
    `<script>window.__UKIKI_BOOT__=${safeJson(boot)};</script>`,
    `<script>${KIT_SCRIPT}</script>`,
    "</head><body>",
    stripDocumentShell(gameHtml),
    "</body></html>",
  ].join("");
}

/** iframe 이 보낸 메시지를 확인한다. 약속에 없는 건 null */
export function parseKitMessage(raw: unknown): KitMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.__ukiki !== true) return null;
  switch (m.type) {
    case "ready":
      return { type: "ready" };
    case "send": {
      const data = m.data === undefined ? null : m.data;
      let size: number;
      try {
        size = JSON.stringify(data).length;
      } catch {
        return null;
      }
      return size > MAX_SEND_BYTES ? null : { type: "send", data };
    }
    case "score":
      return typeof m.value === "number" && Number.isFinite(m.value) ? { type: "score", value: m.value } : null;
    case "end": {
      const r = (m.result && typeof m.result === "object" ? m.result : {}) as Record<string, unknown>;
      const winners = Array.isArray(r.winners) ? r.winners.filter((w): w is string => typeof w === "string") : [];
      return { type: "end", result: { winners, teamSuccess: r.teamSuccess === true } };
    }
    default:
      return null;
  }
}
