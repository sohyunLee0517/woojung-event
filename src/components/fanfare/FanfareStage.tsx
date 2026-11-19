"use client";

import TemperatureGauge from "@/components/TemperatureGauge";
import TopBar from "@/components/ukiki/TopBar";
import { ghostButton, primaryButton, UK } from "@/components/ukiki/styles";
import { tapRanking, temperatureLabel, type FanfarePhase } from "@/lib/fanfare/logic";

// 호스트 없는 빵빠레 화면 (보이는 것만). 실시간 연결은 FanfareGame 이, 로컬 미리보기는 /dev/fanfare 가 맡는다.
//   준비완료 → (모두 준비) 3·2·1 → 시작! → 🔥 마구 누르기 → 100도 폭죽 → 탭 순위

export type StagePlayer = { id: string; name: string; ready: boolean };

// 3·2·1: 숫자마다 크게 튀어나왔다가 작아지며 사라진다 · 시작!: 화면 가운데서 터지듯 커진다
const STAGE_CSS = `
.fanfare-count{font-size:168px;font-weight:900;line-height:1;margin:0;
  background:linear-gradient(180deg,#ffd700,#ff6b35 55%,#e03000);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 28px rgba(255,107,53,.7));animation:fanfare-pop 1s cubic-bezier(.2,.9,.3,1.4) both}
@keyframes fanfare-pop{0%{transform:scale(2.6);opacity:0}25%{transform:scale(.9);opacity:1}45%{transform:scale(1.05)}80%{transform:scale(1);opacity:1}100%{transform:scale(.6);opacity:0}}
.fanfare-go{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;pointer-events:none;
  font-size:84px;font-weight:900;color:#fff;text-shadow:0 0 24px #ff6b35,0 0 60px #e03000;
  background:radial-gradient(circle,rgba(255,107,53,.45) 0%,rgba(224,48,0,0) 65%);animation:fanfare-go .9s ease-out both}
@keyframes fanfare-go{0%{transform:scale(.3);opacity:0}30%{transform:scale(1.15);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.6);opacity:0}}
`;

const center: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  textAlign: "center",
  padding: "0 16px 40px",
};

export default function FanfareStage({
  backHref,
  phase,
  temperature,
  count,
  showGo,
  players,
  taps,
  meId,
  tapFlash,
  onReady,
  onClose,
  onTap,
}: {
  backHref: string;
  phase: FanfarePhase;
  temperature: number;
  /** 카운트다운 숫자 (3·2·1) */
  count: number;
  /** 막 시작했을 때 '시작!' 연출 */
  showGo: boolean;
  players: StagePlayer[];
  taps: Record<string, number>;
  meId: string;
  tapFlash: boolean;
  onReady: () => void;
  onClose: () => void;
  onTap: () => void;
}) {
  const myReady = players.find((p) => p.id === meId)?.ready === true;
  const readyCount = players.filter((p) => p.ready).length;
  const allReady = players.length >= 2 && readyCount === players.length;
  const ranking = tapRanking(players, taps);

  const chips = (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
      {players.length === 0 && <span style={{ fontSize: 13, opacity: 0.5 }}>아직 들어온 친구가 없어요</span>}
      {players.map((p) => (
        <span
          key={p.id}
          style={{
            fontSize: 12,
            padding: "3px 10px",
            borderRadius: 999,
            fontWeight: 700,
            background: p.id === meId ? "#f9731633" : "rgba(255,255,255,.08)",
            color: p.id === meId ? "#f97316" : "#fff",
            border: p.id === meId ? "1px solid #f97316" : "1px solid transparent",
          }}
        >
          {phase === "WAITING" && (p.ready ? "✅ " : "⏳ ")}
          {p.name}
          {p.id === meId ? " (나)" : ""}
        </span>
      ))}
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", color: "#fff", fontFamily: "sans-serif", userSelect: "none" }}>
      <style>{STAGE_CSS}</style>
      <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar backHref={backHref} title="🎉 빵빠레" sub={<p style={{ fontSize: 12, opacity: 0.6 }}>👥 {players.length}명 참여</p>} />

        {phase === "WAITING" && (
          <div style={center}>
            <p style={{ fontSize: 56 }}>🌡️</p>
            <p style={{ fontSize: 18, fontWeight: 800 }}>{allReady ? "곧 시작해요!" : `준비 ${readyCount}/${players.length}`}</p>
            {chips}
            <button
              onClick={onReady}
              style={{
                ...primaryButton,
                width: "100%",
                maxWidth: 320,
                background: myReady ? "rgba(255,255,255,.12)" : primaryButton.background,
                color: myReady ? "#fff" : primaryButton.color,
              }}
            >
              {myReady ? "✅ 준비완료 (취소하려면 눌러요)" : "🔥 준비완료"}
            </button>
            {players.length < 2 && <p style={{ fontSize: 13, color: UK.yellow }}>2명부터 시작할 수 있어요</p>}
            <button onClick={onClose} style={{ ...ghostButton, padding: "8px 14px", fontSize: 13, opacity: 0.7 }}>
              빵빠레 닫기
            </button>
          </div>
        )}

        {phase === "COUNTDOWN" && (
          <div style={{ ...center, gap: 8 }}>
            <p style={{ fontSize: 14, opacity: 0.6, letterSpacing: 4 }}>모두 준비 완료!</p>
            <p key={count} className="fanfare-count">
              {count}
            </p>
            <p style={{ fontSize: 14, opacity: 0.6 }}>🔥 버튼을 마구 눌러 온도를 올려요</p>
          </div>
        )}

        {showGo && (
          <div className="fanfare-go" aria-hidden>
            시작! 🔥
          </div>
        )}

        {phase === "PLAYING" && (
          <>
            <div style={{ ...center, gap: 12 }}>
              {chips}
              <TemperatureGauge temperature={temperature} />
              <p style={{ opacity: 0.4, fontSize: 14, letterSpacing: 3 }}>{temperatureLabel(temperature)}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 32 }}>
              <button
                onPointerDown={onTap}
                aria-label="온도 올리기"
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  fontSize: 56,
                  background: tapFlash ? "radial-gradient(circle at 35% 30%, #ffb347, #cc2200)" : "radial-gradient(circle at 35% 30%, #ff7c3a, #e03000)",
                  boxShadow: tapFlash ? "0 3px 0 #880000, 0 6px 20px rgba(0,0,0,.6)" : "0 8px 0 #880000, 0 14px 30px rgba(0,0,0,.5)",
                  transform: tapFlash ? "translateY(5px)" : "none",
                  transition: "transform .08s, box-shadow .08s",
                  border: "3px solid rgba(255,120,50,.6)",
                  touchAction: "manipulation",
                }}
              >
                🔥
              </button>
            </div>
          </>
        )}

        {phase === "CELEBRATION" && (
          <div style={center}>
            <p style={{ fontSize: 72 }}>🎉</p>
            <p style={{ fontSize: 30, fontWeight: 900 }}>MAX 우정!</p>
            <p style={{ opacity: 0.45, fontSize: 14 }}>100° 달성</p>
          </div>
        )}

        {phase === "RANKING" && (
          <div style={center}>
            <p style={{ fontSize: 12, opacity: 0.5, letterSpacing: 3 }}>우정 온도 기여</p>
            <p style={{ fontSize: 24, fontWeight: 900 }}>탭 순위</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 8 }}>
              {ranking.map((r) => (
                <li
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: r.id === meId ? "#f9731618" : "rgba(255,255,255,.05)",
                    border: `1.5px solid ${r.id === meId ? "#f9731655" : "rgba(255,255,255,.1)"}`,
                  }}
                >
                  <span style={{ width: 36, fontSize: 20 }}>{r.medal || `${r.rank}위`}</span>
                  <span style={{ flex: 1, textAlign: "left", fontWeight: 700 }}>
                    {r.name}
                    {r.id === meId ? " (나)" : ""}
                  </span>
                  <span style={{ color: "#f97316", fontWeight: 900 }}>{r.taps}탭</span>
                </li>
              ))}
            </ul>
            <a href={backHref} style={{ ...ghostButton, textDecoration: "none", marginTop: 8 }}>
              방으로 돌아가기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
