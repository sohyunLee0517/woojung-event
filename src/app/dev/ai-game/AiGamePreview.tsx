"use client";

import PreviewPlayground from "@/components/game-maker/PreviewPlayground";

// 예제: 10초 동안 많이 누르기. 누를 때마다 모두에게 알려서 서로의 숫자가 보이고, 끝나면 각자 점수를 낸다.
const SAMPLE = `
<style>
  #wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
  #time{font-size:40px;font-weight:900;color:#ffd84d}
  #tap{width:180px;height:180px;border-radius:50%;border:none;font-size:64px;background:#ffd84d}
  #board{font-size:16px;text-align:center;line-height:1.8}
</style>
<div id="wrap">
  <div id="time">10</div>
  <button id="tap">🍌</button>
  <div id="board"></div>
</div>
<script>
  var counts = {}; ukiki.players.forEach(function(p){ counts[p.id] = 0; });
  var mine = 0, left = 10;
  function draw(){
    document.getElementById("board").innerHTML = ukiki.players.map(function(p){
      return p.emoji + " " + p.name + (p.id === ukiki.me ? " (나)" : "") + ": " + counts[p.id];
    }).join("<br>");
  }
  ukiki.on(function(e){ counts[e.from] = e.data.n; draw(); });
  document.getElementById("tap").addEventListener("pointerdown", function(){
    if (left <= 0) return;
    mine++; ukiki.send({ n: mine });
  });
  var t = setInterval(function(){
    left--; document.getElementById("time").textContent = left;
    if (left <= 0){ clearInterval(t); document.getElementById("time").textContent = "끝!"; setTimeout(function(){ ukiki.score(mine); }, 800); }
  }, 1000);
  draw();
</script>`;

export default function AiGamePreview() {
  return (
    <main style={{ position: "absolute", inset: 0, background: "#0a0a0a", color: "#fff", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800 }}>🤖 AI 게임 미리보기 (예제)</h1>
      <div style={{ flex: 1, minHeight: 0, maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <PreviewPlayground html={SAMPLE} title="바나나 연타" emoji="🍌" />
      </div>
    </main>
  );
}
