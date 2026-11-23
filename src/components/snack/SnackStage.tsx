"use client";
import BackToRoom from "@/components/ukiki/BackToRoom";

import { useRef, useState } from "react";
import TopBar from "@/components/ukiki/TopBar";
import { CountdownView, GoBurst, PlayerChips, NoGame, ReadyStyles, ReadyWaiting, readyCenter, type ReadyPlayer, type WaitView } from "@/components/ukiki/ReadyRoom";
import { ghostButton, UK } from "@/components/ukiki/styles";
import { clampCut, SNACK_TOTAL } from "@/lib/snack/logic";

// 과자 나눠먹기 화면 (보이는 것만). 실제 게임은 SnackGame, 미리보기는 /dev/snack.
//   과자 위를 손가락으로 끌어 칼 위치를 정하고, 손을 떼는 순간 '싹둑' (한 번뿐, 바로 확정)
//   모두 자르면 공개: 각자 몫이 과자 위에 차례로 쌓이고, 100을 넘으면 와장창 실패

export type SnackPhase = "WAITING" | "COUNTDOWN" | "CUTTING" | "DONE" | "RESULT";
export type SnackPlayer = ReadyPlayer & { done: boolean; cut: number | null };

const BAR_W = 300;
const COLORS = ["#f97316", "#22c55e", "#3b82f6", "#e11d48", "#a855f7", "#eab308", "#14b8a6", "#f43f5e"];

const CSS = `
.sn-chop{animation:sn-chop .35s cubic-bezier(.5,0,.6,1) both}
@keyframes sn-chop{0%{transform:translateY(-70px) rotate(-8deg)}70%{transform:translateY(6px) rotate(0)}100%{transform:translateY(0)}}
.sn-take{animation:sn-take .6s .25s ease-out both}
@keyframes sn-take{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(-14px,58px) rotate(-6deg)}}
.sn-seg{animation:sn-seg .45s cubic-bezier(.2,1.3,.4,1) both}
@keyframes sn-seg{0%{transform:translateY(-40px) scaleY(.4);opacity:0}100%{transform:translateY(0) scaleY(1);opacity:1}}
.sn-crumble{animation:sn-crumble 1s ease-in both}
@keyframes sn-crumble{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),160px) rotate(var(--dr));opacity:0}}
.sn-pop{animation:sn-pop .5s cubic-bezier(.2,1.6,.4,1) both}
@keyframes sn-pop{0%{transform:scale(2.5);opacity:0}100%{transform:scale(1);opacity:1}}
.sn-crack{animation:sn-crack .4s ease-out both}
@keyframes sn-crack{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}50%{transform:translateX(7px)}75%{transform:translateX(-4px)}}
`;

/** 과자 막대 (초코칩 쿠키 무늬) */
function Cookie({ width, style }: { width: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height: 56,
        borderRadius: 14,
        background:
          "radial-gradient(circle at 12% 30%, #4a2a12 0 4px, transparent 5px), radial-gradient(circle at 38% 70%, #4a2a12 0 5px, transparent 6px), radial-gradient(circle at 63% 35%, #4a2a12 0 4px, transparent 5px), radial-gradient(circle at 86% 65%, #4a2a12 0 5px, transparent 6px), linear-gradient(#e8b06a, #c98a43)",
        backgroundSize: "70px 56px, 70px 56px, 70px 56px, 70px 56px, 100% 100%",
        boxShadow: "inset 0 -6px 10px rgba(0,0,0,.25), inset 0 4px 6px rgba(255,255,255,.25), 0 8px 18px rgba(0,0,0,.4)",
        ...style,
      }}
    />
  );
}

export default function SnackStage({
  backHref,
  phase,
  players,
  meId,
  count,
  showGo,
  myCut,
  total,
  failed,
  spectator,
  onReady,
  onCut,
  onNudge,
  wait,
  cancelled = false,
  cutLeft,
}: {
  /** 자를 수 있는 남은 초 (0 이 되면 안 자른 사람은 0으로 치고 결과) */
  cutLeft?: number;
  /** 대기 제한 시간 (남은 초·방 인원) */
  wait?: WaitView;
  /** 노게임으로 닫힘 */
  cancelled?: boolean;
  backHref: string;
  phase: SnackPhase;
  players: SnackPlayer[];
  meId: string;
  count: number;
  showGo: boolean;
  /** 내가 자른 양 (잘랐으면) */
  myCut: number | null;
  /** 결과: 합계 */
  total: number | null;
  failed: boolean;
  /** 시작한 뒤 들어와 구경만 하는 사람 */
  spectator: boolean;
  onReady: () => void;
  onCut: (amount: number) => void;
  onNudge?: () => Promise<string>;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<number | null>(null);
  const [chopped, setChopped] = useState<number | null>(null);

  const amountAt = (clientX: number) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r) return 1;
    return clampCut(((clientX - r.left) / r.width) * SNACK_TOTAL);
  };
  const down = (e: React.PointerEvent) => {
    if (phase !== "CUTTING" || chopped !== null) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setPos(amountAt(e.clientX));
  };
  const move = (e: React.PointerEvent) => {
    if (pos === null || chopped !== null) return;
    setPos(amountAt(e.clientX));
  };
  const up = (e: React.PointerEvent) => {
    if (pos === null || chopped !== null) return;
    const a = amountAt(e.clientX);
    setChopped(a);
    setPos(null);
    onCut(a);
  };

  const doneCount = players.filter((p) => p.done).length;
  const cutShown = chopped ?? myCut;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", color: "#fff", fontFamily: "sans-serif", userSelect: "none" }}>
      <ReadyStyles />
      <style>{CSS}</style>
      <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar backHref={backHref} title="🍪 과자 나눠먹기" sub={<p style={{ fontSize: 12, opacity: 0.6 }}>👥 {players.length}명 참여</p>} />

        {phase === "WAITING" && cancelled && <NoGame emoji="🍪" backHref={backHref} />}
        {phase === "WAITING" && !cancelled && <ReadyWaiting players={players} meId={meId} emoji="🍪" onReady={onReady} onNudge={onNudge} wait={wait} />}
        {phase === "COUNTDOWN" && <CountdownView count={count} hint="🔪 한 번만 자를 수 있어요. 합이 100을 넘으면 실패!" />}
        {showGo && <GoBurst label="시작! 🔪" />}

        {(phase === "CUTTING" || phase === "DONE") && (
          <div style={{ ...readyCenter, gap: 20 }}>
            <PlayerChips players={players.map((p) => ({ ...p, ready: p.done }))} meId={meId} showReady />
            <p style={{ fontSize: 18, fontWeight: 800 }}>
              {spectator
                ? "구경 중이에요 👀"
                : cutShown === null
                  ? "과자 위를 끌어서 자를 곳을 정하고, 손을 떼면 싹둑!"
                  : `완료! 친구들 기다리는 중 (${doneCount}/${players.length})`}
            </p>
            <p style={{ fontSize: 12, opacity: 0.55, marginTop: -12 }}>기회는 한 번뿐 · 다른 친구가 얼마나 가져갔는지는 몰라요</p>
            {cutLeft !== undefined && (
              <p role="timer" style={{ fontSize: 13, fontWeight: 700, marginTop: -10, color: cutLeft <= 10 ? "#ff6b6b" : UK.yellow }}>
                ⏳ {cutLeft}초
              </p>
            )}

            <div style={{ position: "relative", width: BAR_W, height: 160 }}>
              {/* 과자 */}
              <div
                ref={barRef}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={() => setPos(null)}
                style={{ position: "absolute", left: 0, top: 50, width: BAR_W, height: 56, touchAction: "none", cursor: phase === "CUTTING" && cutShown === null && !spectator ? "ew-resize" : "default" }}
              >
                {cutShown === null ? (
                  <Cookie width={BAR_W} />
                ) : (
                  <>
                    {/* 내 몫 (잘려서 아래로) */}
                    <div className="sn-take" style={{ position: "absolute", left: 0, top: 0 }}>
                      <Cookie width={(BAR_W * cutShown) / SNACK_TOTAL} style={{ borderRadius: "14px 4px 4px 14px", outline: `2px solid ${UK.yellow}` }} />
                    </div>
                    <div style={{ position: "absolute", left: (BAR_W * cutShown) / SNACK_TOTAL + 3, top: 0 }}>
                      <Cookie width={Math.max(0, BAR_W - (BAR_W * cutShown) / SNACK_TOTAL - 3)} style={{ borderRadius: "4px 14px 14px 4px", opacity: 0.85 }} />
                    </div>
                  </>
                )}
                {/* 칼 (끄는 동안 따라다님 / 자를 때 내려찍음) */}
                {(pos !== null || chopped !== null) && (
                  <div
                    key={chopped ?? "aim"}
                    className={chopped !== null ? "sn-chop" : undefined}
                    style={{ position: "absolute", left: (BAR_W * (chopped ?? pos ?? 0)) / SNACK_TOTAL - 10, top: -48, pointerEvents: "none" }}
                  >
                    <div style={{ width: 20, height: 30, borderRadius: 4, background: "linear-gradient(#5b3a29,#2d1b12)", margin: "0 auto" }} />
                    <div style={{ width: 6, height: 76, margin: "0 auto", background: "linear-gradient(90deg,#f5f6f7,#9aa3ab)", clipPath: "polygon(0 0,100% 0,100% 88%,50% 100%,0 88%)" }} />
                  </div>
                )}
              </div>
              {(pos !== null || cutShown !== null) && (
                <p style={{ position: "absolute", left: 0, right: 0, top: 128, textAlign: "center", fontSize: 22, fontWeight: 900, color: UK.yellow }}>
                  {cutShown ?? pos}%
                </p>
              )}
            </div>
          </div>
        )}

        {phase === "RESULT" && (
          <div style={{ ...readyCenter, gap: 18 }}>
            <p style={{ fontSize: 14, opacity: 0.6, letterSpacing: 3 }}>모두 잘랐어요! 공개합니다</p>
            {/* 과자 한 개(100) 위에 각자 몫을 차례로 쌓는다. 넘친 부분은 부서져 떨어진다 */}
            <div className={failed ? "sn-crack" : undefined} style={{ position: "relative", width: BAR_W, height: 56, marginTop: 10 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 14, border: "2px dashed rgba(255,255,255,.35)" }} />
              {(() => {
                let x = 0;
                return players
                  .filter((p) => p.cut !== null)
                  .map((p, i) => {
                    const w = ((p.cut as number) / SNACK_TOTAL) * BAR_W;
                    const left = x;
                    x += w;
                    const over = left + w > BAR_W;
                    return (
                      <div
                        key={p.id}
                        className={over && failed ? "sn-crumble" : "sn-seg"}
                        style={
                          {
                            position: "absolute",
                            left,
                            top: 0,
                            width: w,
                            height: 56,
                            borderRadius: 8,
                            background: COLORS[i % COLORS.length],
                            boxShadow: "inset 0 -5px 8px rgba(0,0,0,.25)",
                            animationDelay: over && failed ? `${0.5 + i * 0.25}s` : `${i * 0.25}s`,
                            "--dx": `${(i % 2 ? 1 : -1) * 40}px`,
                            "--dr": `${(i % 2 ? 1 : -1) * 40}deg`,
                          } as React.CSSProperties
                        }
                      />
                    );
                  });
              })()}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 6 }}>
              {players
                .filter((p) => p.cut !== null)
                .map((p, i) => (
                  <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length] }} />
                    <span style={{ flex: 1 }}>
                      {p.name}
                      {p.id === meId ? " (나)" : ""}
                    </span>
                    <b>{p.cut}%</b>
                  </li>
                ))}
            </ul>
            <div className="sn-pop" style={{ animationDelay: failed ? "1.4s" : `${players.length * 0.25 + 0.2}s`, textAlign: "center" }}>
              {failed ? (
                <>
                  <p style={{ fontSize: 48, fontWeight: 900, color: "#ff3b30" }}>실패!</p>
                  <p style={{ fontSize: 15, opacity: 0.85 }}>
                    다 합쳐 {total}% — 과자가 모자라요 🍪💥
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 14, opacity: 0.7 }}>팀 점수</p>
                  <p style={{ fontSize: 56, fontWeight: 900, color: UK.yellow }}>{total}점</p>
                  <p style={{ fontSize: 14, opacity: 0.7 }}>{total === SNACK_TOTAL ? "딱 맞게 나눴어요! 🎯" : `과자 ${SNACK_TOTAL - (total ?? 0)}%가 남았어요`}</p>
                </>
              )}
              <BackToRoom href={backHref} style={{ display: "inline-block", marginTop: 14 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
