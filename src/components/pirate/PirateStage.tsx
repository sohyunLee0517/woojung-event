"use client";

import { useEffect, useRef, useState } from "react";
import TopBar from "@/components/ukiki/TopBar";
import { CountdownView, GoBurst, PlayerChips, ReadyStyles, ReadyWaiting, readyCenter, type ReadyPlayer } from "@/components/ukiki/ReadyRoom";
import { ghostButton, UK } from "@/components/ukiki/styles";
import { HOLES } from "@/lib/pirate/logic";

// 해적 무찌르기 화면 (보이는 것만). 실제 게임은 PirateGame, 미리보기는 /dev/pirate 가 상태를 넣어 준다.
//   통을 좌우로 드래그하면 빙글 돈다 → 앞쪽 구멍을 누르면 칼이 날아와 꽂힌다
//   함정 구멍이면 해적이 화면 가득 튀어나오며 "실패!" / 함정 하나만 남으면 "성공!"

export type PiratePhase = "WAITING" | "COUNTDOWN" | "PLAYING" | "FAIL" | "SUCCESS";

const PER_ROW = HOLES / 2; // 위·아래 두 줄
const R = 118; // 통 반지름(px)

const CSS = `
.pr-knife-fly{animation:pr-fly .38s cubic-bezier(.3,.1,.4,1) both}
@keyframes pr-fly{0%{transform:translate(var(--fx),var(--fy)) rotate(var(--fr)) scale(1.8);opacity:0}15%{opacity:1}100%{transform:translate(0,0) rotate(0) scale(1);opacity:1}}
.pr-shake{animation:pr-shake .35s ease-out}
@keyframes pr-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px) rotate(-1deg)}45%{transform:translateX(5px) rotate(1deg)}70%{transform:translateX(-3px)}}
.pr-peek{animation:pr-peek 2.4s ease-in-out infinite}
@keyframes pr-peek{0%,100%{transform:translateY(6px)}50%{transform:translateY(-2px)}}
.pr-launch{animation:pr-launch 1.1s cubic-bezier(.2,1.4,.4,1) both}
@keyframes pr-launch{0%{transform:translateY(40px) scale(.6) rotate(0)}35%{transform:translateY(-60vh) scale(1.2) rotate(-20deg)}60%{transform:translateY(-10vh) scale(4.2) rotate(8deg)}100%{transform:translateY(0) scale(4) rotate(0)}}
.pr-fail-text{animation:pr-fail-text .5s .8s cubic-bezier(.2,1.6,.4,1) both}
@keyframes pr-fail-text{0%{transform:scale(3);opacity:0}100%{transform:scale(1);opacity:1}}
.pr-flash{animation:pr-flash .6s .35s ease-out both}
@keyframes pr-flash{0%{opacity:.9}100%{opacity:0}}
`;

function Pirate({ size = 64 }: { size?: number }) {
  // 해골 모자 쓴 해적 얼굴 (이모지로 겹쳐 그림)
  return (
    <div style={{ position: "relative", width: size, height: size * 1.15, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <span style={{ fontSize: size, lineHeight: 1 }}>🧔🏻</span>
      <span
        style={{
          position: "absolute",
          top: -size * 0.12,
          left: "50%",
          transform: "translateX(-50%)",
          width: size * 1.05,
          height: size * 0.42,
          borderRadius: `${size * 0.5}px ${size * 0.5}px ${size * 0.08}px ${size * 0.08}px`,
          background: "#1b1b1b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.24,
          boxShadow: "0 2px 0 #000",
        }}
      >
        ☠️
      </span>
      <span style={{ position: "absolute", top: size * 0.42, left: size * 0.2, fontSize: size * 0.22 }}>🏴</span>
    </div>
  );
}

function Knife({ fly, from }: { fly: boolean; from: { x: number; y: number; r: number } }) {
  return (
    <div
      className={fly ? "pr-knife-fly" : undefined}
      style={
        {
          "--fx": `${from.x}px`,
          "--fy": `${from.y}px`,
          "--fr": `${from.r}deg`,
          width: 34,
          height: 12,
          position: "relative",
        } as React.CSSProperties
      }
    >
      {/* 칼자루 (구멍 밖으로 튀어나온 부분) */}
      <span style={{ position: "absolute", left: 0, top: 2, width: 22, height: 8, borderRadius: 3, background: "linear-gradient(#c0392b,#7b1d14)" }} />
      <span style={{ position: "absolute", left: 20, top: 0, width: 5, height: 12, borderRadius: 2, background: "#f1c40f" }} />
      <span style={{ position: "absolute", left: 24, top: 3, width: 10, height: 6, background: "linear-gradient(#ecf0f1,#95a5a6)", clipPath: "polygon(0 0,100% 50%,0 100%)" }} />
    </div>
  );
}

export default function PirateStage({
  backHref,
  phase,
  players,
  meId,
  count,
  showGo,
  turnName,
  myTurn,
  stabs,
  onReady,
  onStab,
  onNudge,
}: {
  backHref: string;
  phase: PiratePhase;
  players: ReadyPlayer[];
  meId: string;
  count: number;
  showGo: boolean;
  /** 지금 차례인 사람 이름 */
  turnName: string | null;
  myTurn: boolean;
  /** 꽂힌 구멍 (꽂은 순서대로) */
  stabs: number[];
  onReady: () => void;
  onStab: (hole: number) => void;
  onNudge?: () => Promise<string>;
}) {
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ x: number; a: number; moved: boolean } | null>(null);
  const [shake, setShake] = useState(0);
  const seen = useRef<number>(stabs.length);
  const [flying, setFlying] = useState<number | null>(null);

  // 새로 꽂힌 칼은 날아오는 연출 + 통 흔들림
  useEffect(() => {
    if (stabs.length > seen.current) {
      const hole = stabs[stabs.length - 1];
      setFlying(hole);
      setShake((n) => n + 1);
      // 새로 꽂힌 구멍이 앞에 보이게 통을 돌린다
      setAngle(-(hole % PER_ROW) * (360 / PER_ROW));
      const t = setTimeout(() => setFlying(null), 450);
      seen.current = stabs.length;
      return () => clearTimeout(t);
    }
    seen.current = stabs.length;
  }, [stabs]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, a: angle, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    setAngle(d.a + dx * 0.6);
  };
  const onPointerUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };

  const stabbed = new Set(stabs);
  const holes = Array.from({ length: HOLES }, (_, i) => {
    const row = i < PER_ROW ? 0 : 1;
    const a = ((i % PER_ROW) * (360 / PER_ROW) + angle + (row ? 360 / PER_ROW / 2 : 0)) * (Math.PI / 180);
    const z = Math.cos(a); // 1 이 정면
    return { i, row, x: Math.sin(a) * R, z, front: z > 0.25 };
  }).sort((p, q) => p.z - q.z);

  const playing = phase === "PLAYING";
  const ended = phase === "FAIL" || phase === "SUCCESS";

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", color: "#fff", fontFamily: "sans-serif", userSelect: "none" }}>
      <ReadyStyles />
      <style>{CSS}</style>
      <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
        <TopBar backHref={backHref} title="🏴‍☠️ 해적 무찌르기" sub={<p style={{ fontSize: 12, opacity: 0.6 }}>👥 {players.length}명 참여</p>} />

        {phase === "WAITING" && (
          <ReadyWaiting players={players} meId={meId} emoji="🏴‍☠️" waitingFor="친구가 들어오길 기다리는 중" onReady={onReady} onNudge={onNudge} />
        )}
        {phase === "COUNTDOWN" && <CountdownView count={count} hint="🗡️ 입장한 순서대로 칼을 꽂아요" />}
        {showGo && <GoBurst label="시작! 🗡️" />}

        {(playing || ended) && (
          <div style={{ ...readyCenter, gap: 18, justifyContent: "flex-start", paddingTop: 12 }}>
            <PlayerChips players={players} meId={meId} />
            <p style={{ fontSize: 17, fontWeight: 800, minHeight: 24, color: myTurn ? UK.yellow : "#fff" }}>
              {playing && (myTurn ? "내 차례! 구멍을 눌러 칼을 꽂아요" : `${turnName ?? "친구"}님 차례`)}
            </p>
            <p style={{ fontSize: 12, opacity: 0.5, marginTop: -12 }}>통을 좌우로 밀면 돌아가요 · 남은 칼 {Math.max(0, HOLES - 1 - stabs.length)}개</p>

            {/* 통 */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={onPointerUp}
              style={{ position: "relative", width: 300, height: 330, touchAction: "none", cursor: "grab" }}
            >
              {/* 해적 (통 위로 고개만) */}
              <div className={phase === "FAIL" ? undefined : "pr-peek"} style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", zIndex: 1, visibility: phase === "FAIL" ? "hidden" : "visible" }}>
                <Pirate size={70} />
              </div>
              <div
                key={shake}
                className={shake ? "pr-shake" : undefined}
                style={{
                  position: "absolute",
                  left: 30,
                  top: 64,
                  width: 240,
                  height: 250,
                  zIndex: 2,
                  borderRadius: "46% 46% 40% 40% / 14% 14% 12% 12%",
                  background: `repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 2px, transparent 2px ${30}px), radial-gradient(ellipse at 50% 40%, #b97a3f, #7a4a1f 70%, #4e2d10)`,
                  boxShadow: "inset 0 -14px 24px rgba(0,0,0,.45), inset 0 14px 18px rgba(255,255,255,.08), 0 18px 30px rgba(0,0,0,.5)",
                }}
              >
                {/* 쇠테 */}
                {[24, 226].map((t) => (
                  <span key={t} style={{ position: "absolute", left: -2, right: -2, top: t - 7, height: 12, borderRadius: 6, background: "linear-gradient(#7f8c8d,#2c3e50)" }} />
                ))}
                {/* 구멍과 칼 */}
                {holes.map((h) => {
                  const scale = 0.55 + 0.45 * Math.max(0, h.z);
                  const top = h.row === 0 ? 82 : 156;
                  const isStabbed = stabbed.has(h.i);
                  const clickable = playing && myTurn && h.front && !isStabbed;
                  if (h.z < -0.05) return null;
                  return (
                    <button
                      key={h.i}
                      aria-label={`${h.i + 1}번 구멍`}
                      disabled={!clickable}
                      onClick={() => {
                        if (drag.current?.moved) return;
                        if (clickable) onStab(h.i);
                      }}
                      style={{
                        position: "absolute",
                        left: 120 + h.x - 15,
                        top,
                        width: 30,
                        height: 22,
                        padding: 0,
                        border: "none",
                        borderRadius: "50%",
                        transform: `scaleX(${scale})`,
                        background: isStabbed ? "#120802" : clickable ? "radial-gradient(#000 50%, #3a2210)" : "radial-gradient(#0d0602 55%, #3a2210)",
                        boxShadow: clickable ? `0 0 0 2px ${UK.yellow}aa` : "none",
                        opacity: 0.35 + 0.65 * Math.max(0, h.z),
                        cursor: clickable ? "pointer" : "default",
                        zIndex: Math.round(h.z * 10) + 10,
                      }}
                    >
                      {isStabbed && h.front && (
                        <span style={{ position: "absolute", left: h.x >= 0 ? 10 : -16, top: 5, transform: h.x >= 0 ? "none" : "scaleX(-1)" }}>
                          <Knife fly={flying === h.i} from={{ x: h.x >= 0 ? 260 : -260, y: -180, r: h.x >= 0 ? -30 : 30 }} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {phase === "SUCCESS" && (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 30, fontWeight: 900 }}>🎉 성공!</p>
                <p style={{ fontSize: 14, opacity: 0.7 }}>해적이 끝까지 못 나왔어요. 모두의 승리!</p>
                <a href={backHref} style={{ ...ghostButton, textDecoration: "none" }}>
                  방으로 돌아가기
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 실패: 해적이 화면 가득 튀어나온다 */}
      {phase === "FAIL" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle, rgba(120,0,0,.55), rgba(0,0,0,.85))" }}>
          <div className="pr-flash" style={{ position: "absolute", inset: 0, background: "#fff" }} />
          <div className="pr-launch">
            <Pirate size={70} />
          </div>
          <p className="pr-fail-text" style={{ marginTop: 150, fontSize: 64, fontWeight: 900, color: "#ff3b30", textShadow: "0 0 24px #000, 0 4px 0 #000" }}>
            실패!
          </p>
          <p className="pr-fail-text" style={{ fontSize: 16, opacity: 0.85 }}>해적이 튀어나왔어요 🏴‍☠️</p>
          <a href={backHref} className="pr-fail-text" style={{ ...ghostButton, textDecoration: "none", marginTop: 16 }}>
            방으로 돌아가기
          </a>
        </div>
      )}
    </div>
  );
}
