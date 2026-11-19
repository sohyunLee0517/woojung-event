"use client";

import TemperatureGauge from "@/components/TemperatureGauge";
import TopBar from "@/components/ukiki/TopBar";
import { CountdownView, GoBurst, PlayerChips, ReadyStyles, ReadyWaiting, type ReadyPlayer } from "@/components/ukiki/ReadyRoom";
import { ghostButton } from "@/components/ukiki/styles";
import { tapRanking, temperatureLabel, type FanfarePhase } from "@/lib/fanfare/logic";

// 호스트 없는 빵빠레 화면 (보이는 것만). 실시간 연결은 FanfareGame 이, 로컬 미리보기는 /dev/fanfare 가 맡는다.
//   준비완료 → (모두 준비) 3·2·1 → 시작! → 🔥 마구 누르기 → 100도 폭죽 → 탭 순위

export type StagePlayer = ReadyPlayer;

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
  onTap,
  onNudge,
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
  onTap: () => void;
  /** 재촉하기: 결과 문구를 돌려준다 */
  onNudge?: () => Promise<string>;
}) {
  const ranking = tapRanking(players, taps);

  const chips = <PlayerChips players={players} meId={meId} />;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", color: "#fff", fontFamily: "sans-serif", userSelect: "none" }}>
      <ReadyStyles />
      <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar backHref={backHref} title="🌡️ 우정의 온도" sub={<p style={{ fontSize: 12, opacity: 0.6 }}>👥 {players.length}명 참여</p>} />

        {phase === "WAITING" && (
          <ReadyWaiting players={players} meId={meId} emoji="🌡️" waitingFor="친구가 들어오길 기다리는 중" onReady={onReady} onNudge={onNudge} />
        )}

        {phase === "COUNTDOWN" && <CountdownView count={count} hint="🔥 버튼을 마구 눌러 온도를 올려요" />}

        {showGo && <GoBurst />}

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
