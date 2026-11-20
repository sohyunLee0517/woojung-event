"use client";

import BackToRoom from "@/components/ukiki/BackToRoom";
import { ghostButton, primaryButton } from "@/components/ukiki/styles";
import { BANANAS_PER_PLAY, BANANAS_PER_WIN } from "@/lib/bananas/rules";
import type { KitEndResult, KitPlayer } from "@/lib/game-maker/kit";

const CSS = `
@keyframes ai-pop { 0% { transform: scale(.3); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
@keyframes ai-up { from { transform: translateY(14px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes ai-fall { to { transform: translateY(110vh) rotate(540deg) } }
`;

// 우리가 만든 게임 공통 결과 화면: 승자(👑) 또는 팀 성공(🎉), 받은 바나나, 방으로 돌아가기
export default function AiResult({
  title,
  emoji,
  players,
  result,
  me,
  backHref,
  onRestart,
  showBananas = true,
}: {
  title: string;
  emoji: string;
  players: KitPlayer[];
  result: KitEndResult;
  me: string;
  backHref?: string;
  onRestart?: () => void;
  showBananas?: boolean;
}) {
  const winners = players.filter((p) => result.winners.includes(p.id));
  const iWon = result.teamSuccess || result.winners.includes(me);
  const bananas = BANANAS_PER_PLAY + (iWon ? BANANAS_PER_WIN : 0);
  const headline = result.teamSuccess ? "🎉 팀 성공!" : winners.length ? "👑 오늘의 1등" : "😅 이번 판은 승자가 없어요";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: 16, background: "radial-gradient(circle at 50% 25%, #3a2a00, #0d0d14 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20, textAlign: "center", color: "#fff" }}>
      <style>{CSS}</style>
      {(result.teamSuccess || winners.length > 0) &&
        Array.from({ length: 22 }, (_, i) => (
          <span key={i} aria-hidden style={{ position: "absolute", top: -24, left: `${(i * 41) % 100}%`, fontSize: 18, animation: `ai-fall ${2.6 + (i % 5) * 0.4}s ${(i % 6) * 0.3}s linear infinite` }}>
            🍌
          </span>
        ))}
      <p style={{ fontSize: 13, opacity: 0.6 }}>
        {emoji} {title}
      </p>
      <p style={{ fontSize: 26, fontWeight: 900, animation: "ai-pop .6s ease-out both" }}>{headline}</p>
      {result.teamSuccess ? (
        <p style={{ fontSize: 15, opacity: 0.85 }}>{players.map((p) => `${p.emoji} ${p.name}`).join("  ")}</p>
      ) : (
        winners.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, animation: "ai-up .5s .2s ease-out both" }}>
            {winners.map((w) => (
              <div key={w.id} style={{ padding: "10px 16px", borderRadius: 16, background: "rgba(255,215,0,.15)", border: "1px solid #ffd700" }}>
                <p style={{ fontSize: 34 }}>{w.emoji}</p>
                <p style={{ fontWeight: 800 }}>
                  {w.name}
                  {w.id === me ? " (나)" : ""}
                </p>
              </div>
            ))}
          </div>
        )
      )}
      {showBananas && (
        <p style={{ fontSize: 15, fontWeight: 800, color: "#ffd84d", animation: "ai-up .5s .4s ease-out both" }}>
          🍌 바나나 +{bananas} {iWon ? `(참여 ${BANANAS_PER_PLAY} + 승리 ${BANANAS_PER_WIN})` : "(참여)"}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 300, marginTop: 6 }}>
        {onRestart && (
          <button onClick={onRestart} style={{ ...primaryButton }}>
            🔁 다시 해 보기
          </button>
        )}
        {backHref && <BackToRoom href={backHref} primary={!onRestart} />}
        {!backHref && !onRestart && <span style={ghostButton}>끝!</span>}
      </div>
    </div>
  );
}
