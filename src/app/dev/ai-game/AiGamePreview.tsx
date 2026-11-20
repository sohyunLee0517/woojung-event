"use client";

import { useState } from "react";
import PreviewPlayground from "@/components/game-maker/PreviewPlayground";
import { runSmokeTest } from "@/components/game-maker/smoke-runner";

// 문제 있는 예제: 누르면 오류가 나고, 끝나지도 않는다
const BROKEN = `<button id="b" style="font-size:40px">누르기</button>
<script>
  document.getElementById("b").addEventListener("pointerdown", function(){ null.boom(); });
  ukiki.on(function(){});
</script>`;

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
  const [result, setResult] = useState("");
  const [html, setHtml] = useState(SAMPLE);
  const test = async (label: string, html: string) => {
    setResult(`${label}: 테스트 중…`);
    const t = Date.now();
    const r = await runSmokeTest(html);
    setResult(`${label}: ${r.ok ? "✅ 통과" : "❌ 실패"} (${((Date.now() - t) / 1000).toFixed(1)}초)${r.problems.length ? " · " + r.problems.join(" / ") : ""}`);
  };
  // ?scroll=1 이면 만들기 화면과 같은 배치(스크롤 페이지 안 62vh 상자)
  const scroll = typeof window !== "undefined" && location.search.includes("scroll");
  const controls = (
    <>
      <h1 style={{ fontSize: 18, fontWeight: 800 }}>🤖 AI 게임 미리보기 (예제)</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => test("좋은 예제", SAMPLE)}>자동 테스트: 좋은 예제</button>
        <button onClick={() => test("문제 예제", BROKEN)}>자동 테스트: 문제 예제</button>

      </div>
      <p id="smoke-result" style={{ fontSize: 13 }}>{result}</p>
    </>
  );
  if (scroll) {
    return (
      <main style={{ position: "absolute", inset: 0, overflowY: "auto", color: "#fff", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 48px", display: "flex", flexDirection: "column", gap: 14 }}>
          {controls}
          <div style={{ height: "62vh", minHeight: 380 }}>
            <PreviewPlayground html={html} title="바나나 연타" emoji="🍌" />
          </div>
          <div style={{ height: 600, background: "#222", borderRadius: 16 }}>아래 내용 (스크롤용)</div>
        </div>
      </main>
    );
  }
  return (
    <main style={{ position: "absolute", inset: 0, background: "#0a0a0a", color: "#fff", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {controls}
      <div style={{ flex: 1, minHeight: 0, maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <PreviewPlayground html={html} title="바나나 연타" emoji="🍌" />
      </div>
    </main>
  );
}
