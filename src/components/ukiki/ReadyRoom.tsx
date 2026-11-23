"use client";

import { useState } from "react";
import { ghostButton, primaryButton, UK } from "./styles";
import BackToRoom from "./BackToRoom";

// 모든 게임 공통 화면: 준비완료 대기실 → 3·2·1 → 시작!
//   <ReadyStyles /> 를 게임 화면에 한 번 깔고, 단계에 맞게 아래 컴포넌트를 보여 준다.

export type ReadyPlayer = { id: string; name: string; ready: boolean };

export const READY_CSS = `
.uk-count{font-size:168px;font-weight:900;line-height:1;margin:0;
  background:linear-gradient(180deg,#ffd700,#ff6b35 55%,#e03000);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 28px rgba(255,107,53,.7));animation:uk-count-pop 1s cubic-bezier(.2,.9,.3,1.4) both}
@keyframes uk-count-pop{0%{transform:scale(2.6);opacity:0}25%{transform:scale(.9);opacity:1}45%{transform:scale(1.05)}80%{transform:scale(1);opacity:1}100%{transform:scale(.6);opacity:0}}
.uk-go{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;pointer-events:none;
  font-size:84px;font-weight:900;color:#fff;text-shadow:0 0 24px #ff6b35,0 0 60px #e03000;
  background:radial-gradient(circle,rgba(255,107,53,.45) 0%,rgba(224,48,0,0) 65%);animation:uk-go .9s ease-out both}
@keyframes uk-go{0%{transform:scale(.3);opacity:0}30%{transform:scale(1.15);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.6);opacity:0}}
`;

export function ReadyStyles() {
  return <style>{READY_CSS}</style>;
}

export const readyCenter: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  textAlign: "center",
  padding: "0 16px 40px",
};

/** 참여자 칩. showReady 면 ✅/⏳ 를 붙인다 */
export function PlayerChips({ players, meId, showReady }: { players: ReadyPlayer[]; meId: string; showReady?: boolean }) {
  return (
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
          {showReady && (p.ready ? "✅ " : "⏳ ")}
          {p.name}
          {p.id === meId ? " (나)" : ""}
        </span>
      ))}
    </div>
  );
}

/** 대기실: 준비 n/m, 참여자, 준비완료 버튼, 재촉하기 */
export function ReadyWaiting({
  players,
  meId,
  emoji,
  waitingFor = "친구가 들어오길 기다리는 중",
  onReady,
  onNudge,
  wait,
}: {
  players: ReadyPlayer[];
  meId: string;
  emoji: string;
  waitingFor?: string;
  onReady: () => void;
  onNudge?: () => Promise<string>;
  /** 대기 제한 시간이 있는 게임: 남은 초와 방 인원. 전원 준비면 바로, 아니면 시간이 되면 준비한 사람끼리 시작 */
  wait?: WaitView;
}) {
  const [nudgeMsg, setNudgeMsg] = useState("");
  const [nudging, setNudging] = useState(false);
  const myReady = players.find((p) => p.id === meId)?.ready === true;
  const readyCount = players.filter((p) => p.ready).length;
  const allReady = wait ? readyCount >= 2 && readyCount >= wait.roomSize : players.length >= 2 && readyCount === players.length;
  const nudge = async () => {
    if (!onNudge || nudging) return;
    setNudging(true);
    setNudgeMsg(await onNudge());
    setNudging(false);
  };
  return (
    <div style={readyCenter}>
      <p style={{ fontSize: 56 }}>{emoji}</p>
      <p style={{ fontSize: 18, fontWeight: 800 }}>{allReady ? "곧 시작해요!" : `준비 ${readyCount}/${wait ? wait.roomSize : players.length}`}</p>
      {wait && !allReady && (
        <p role="timer" style={{ fontSize: 13, color: UK.yellow, lineHeight: 1.5 }}>
          ⏳ {waitClock(wait.leftSeconds)}{" "}
          {readyCount >= 2 ? `뒤 준비한 ${readyCount}명이서 시작해요` : "안에 2명 이상 준비완료하지 않으면 게임이 취소돼요"}
        </p>
      )}
      <PlayerChips players={players} meId={meId} showReady />
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
      {players.length < 2 && <p style={{ fontSize: 13, color: UK.yellow }}>{waitingFor}</p>}
      {onNudge && (
        <button onClick={nudge} disabled={nudging} style={{ ...ghostButton, width: "100%", maxWidth: 320, opacity: nudging ? 0.6 : 1 }}>
          📣 안 들어온 친구 재촉하기
        </button>
      )}
      {nudgeMsg && <p style={{ fontSize: 13, color: UK.yellow }}>{nudgeMsg}</p>}
    </div>
  );
}

export type WaitView = { leftSeconds: number; roomSize: number };

/** 남은 시간 m:ss */
export function waitClock(seconds: number) {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 노게임: 제한 시간에 준비완료한 사람이 2명이 안 돼서 닫힌 게임 */
export function NoGame({ emoji, backHref }: { emoji: string; backHref: string }) {
  return (
    <div style={readyCenter}>
      <p style={{ fontSize: 56 }}>{emoji}</p>
      <p style={{ fontSize: 20, fontWeight: 800 }}>😴 노게임</p>
      <p style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.6 }}>
        시간 안에 준비완료한 친구가 2명이 안 돼서
        <br />
        게임이 취소됐어요.
      </p>
      <BackToRoom href={backHref} primary style={{ width: "100%", maxWidth: 320 }} />
    </div>
  );
}

/** 3·2·1 (숫자가 바뀔 때마다 튀어나온다) */
export function CountdownView({ count, hint }: { count: number; hint?: string }) {
  return (
    <div style={{ ...readyCenter, gap: 8 }}>
      <p style={{ fontSize: 14, opacity: 0.6, letterSpacing: 4 }}>모두 준비 완료!</p>
      <p key={count} className="uk-count">
        {count}
      </p>
      {hint && <p style={{ fontSize: 14, opacity: 0.6 }}>{hint}</p>}
    </div>
  );
}

/** 막 시작했을 때 화면 가운데서 터지는 '시작!' */
export function GoBurst({ label = "시작! 🔥" }: { label?: string }) {
  return (
    <div className="uk-go" aria-hidden>
      {label}
    </div>
  );
}
