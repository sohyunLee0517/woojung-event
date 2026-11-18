"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { GameState, GamePlayer } from "@/lib/birthday-gacha/games";
import {
  CAPSULE_SET,
  GAME_POLL_INTERVAL_MS,
  GRADE_META,
  MONEY_MAX,
  MONEY_MIN,
  CARD_META,
  MAX_DRAWS_PER_PLAYER,
  TICKETS_ON_JOIN,
  type CardType,
  quizWindowLabel,
  yen,
  type Grade,
} from "@/lib/birthday-gacha/rules";
import type { QuizStatus } from "@/lib/birthday-gacha/quiz";
import InstallCard from "./InstallCard";
import PushCard from "./PushCard";
import { stickyHeaderStyle } from "@/components/ukiki/TopBar";
import { roomMapHref } from "@/lib/birthday-gacha/nav";

type DrawnResult = { grade: Grade; amount: number; minutes: number };
// 화면 가운데에 잠깐 떴다 사라지는 알림
type Notice = { key: number; title: string; emoji?: string; sub?: string; color?: string };
const NOTICE_MS = 2600;
type Phase = "idle" | "spinning" | "reveal";

// 남은 캡슐 색깔. 등급과 상관없는 장식용이라 내용이 새지 않는다.
const BALL_COLORS = ["#ff8fab", "#ffd166", "#8ecae6", "#b9fbc0", "#cdb4db", "#ffc6a5", "#a0c4ff", "#fdffb6", "#caffbf"];
const BALL_POSITIONS = [
  [30, 62], [50, 66], [70, 62], [22, 44], [42, 46], [62, 44], [78, 42], [36, 28], [58, 27],
];

const httpsImage = (url: string | null) => url?.replace(/^http:\/\//, "https://") ?? null;

const DRAW_ERRORS: Record<string, string> = {
  no_ticket: "뽑기권이 없어요.",
  empty: "캡슐이 다 떨어졌어요.",
  not_member: "이 방에 참가하지 않았어요.",
  busy: "동시에 눌렸어요. 다시 눌러 주세요.",
};

function Avatar({ src, size = 36, online }: { src: string | null; size?: number; online?: boolean }) {
  const url = httpsImage(src);
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}>
      <span
        style={{
          display: "block",
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          background: "#333",
        }}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" width={size} height={size} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
        )}
      </span>
      {online !== undefined && (
        <span
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: size * 0.32,
            height: size * 0.32,
            borderRadius: "50%",
            background: online ? "#22c55e" : "#6b7280",
            border: "2px solid #111",
          }}
        />
      )}
    </span>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "80%",
          overflowY: "auto",
          background: "#1a1a1a",
          borderRadius: "20px 20px 0 0",
          padding: "20px 20px 32px",
          animation: "bg-slide-up .25s ease-out",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} aria-label="닫기" style={iconButton}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const iconButton: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "rgba(255,255,255,.08)",
  border: "none",
  color: "#fff",
  fontSize: 18,
  position: "relative",
  cursor: "pointer",
};

function RulesSheet({ onClose }: { onClose: () => void }) {
  const grades = (["SSR", "SR", "R", "N"] as Grade[]).map((g) => ({
    g,
    items: CAPSULE_SET.filter((c) => c.grade === g),
  }));
  return (
    <Sheet title="📜 규칙" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14, lineHeight: 1.6 }}>
        <section>
          <h3 style={ruleHeading}>🎰 뽑기</h3>
          <p>캡슐은 9개(3명 × 3번)이고, 방을 만들 때 섞여요. 뽑기 전에는 누구도 내용을 몰라요.</p>
          <p>뽑기권 1장으로 캡슐 1개를 열어요. 한 사람당 최대 {MAX_DRAWS_PER_PLAYER}번 뽑아요.</p>
        </section>
        <section>
          <h3 style={ruleHeading}>🧩 특수카드 퀴즈</h3>
          <p>참가하면 뽑기권 {TICKETS_ON_JOIN}장을 받아요. 특수카드는 퀴즈로 얻어요.</p>
          <p>하루를 0–2시, 2–4시 … 22–24시 2시간 구간으로 나눠요(한국·일본 시간).</p>
          <p>구간마다 퀴즈 1번만 풀 수 있어요. 틀려도 그 구간은 끝이에요.</p>
          <p>맞히면 특수카드 1장을 무작위로 받아요. 예) 21:59에 풀었으면 1분 뒤 22시부터 다시 풀 수 있어요.</p>
        </section>
        <section>
          <h3 style={ruleHeading}>💎 캡슐 구성</h3>
          {grades.map(({ g, items }) => (
            <p key={g}>
              <span style={{ color: GRADE_META[g].color, fontWeight: 700 }}>
                {GRADE_META[g].emoji} {g}
              </span>{" "}
              {items.length}개 ·{" "}
              {[...new Set(items.map((i) => `${yen(i.amount)} / ${i.minutes}분`))].join(", ")}
            </p>
          ))}
          <p style={{ opacity: 0.7 }}>금액이 클수록 쇼핑 시간이 짧아요. 3개를 뽑으면 합계는 항상 ¥8,500~¥12,500이에요.</p>
        </section>
        <section>
          <h3 style={ruleHeading}>🏴‍☠️ 강탈 (준비 중)</h3>
          <p>
            금액은 {yen(MONEY_MIN)}~{yen(MONEY_MAX)} 사이에서만 움직여요.
          </p>
          <p>· {yen(MONEY_MIN)} 이하인 사람한테는 뺏을 수 없어요.</p>
          <p>· {yen(MONEY_MAX)} 이상이면 뺏을 수 없어요.</p>
          <p>· 넘치는 만큼은 깎여요. 예) ¥12,000인 사람이 ¥2,000을 뺏으면 ¥1,000만 가져와요.</p>
        </section>
        <section>
          <h3 style={ruleHeading}>🃏 특수카드 (사용은 준비 중)</h3>
          {(Object.keys(CARD_META) as CardType[]).map((t) => (
            <p key={t}>
              {CARD_META[t].emoji} <b>{CARD_META[t].name}</b> · {CARD_META[t].desc}
            </p>
          ))}
          <p style={{ opacity: 0.7 }}>카드는 야외에서, 상대가 50m 안에 있을 때만 쓸 수 있어요.</p>
        </section>
      </div>
    </Sheet>
  );
}

const ruleHeading: CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 4 };

function PlayersSheet({ state, onClose }: { state: GameState; onClose: () => void }) {
  return (
    <Sheet title={`👥 플레이어 ${state.players.length}/3`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {state.players.map((p) => (
          <div
            key={p.kakaoId}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: "rgba(255,255,255,.05)" }}
          >
            <Avatar src={p.image} size={44} online={p.online} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700 }}>
                {p.nickname ?? "?"}
                {p.kakaoId === state.me && <span style={{ opacity: 0.6 }}> (나)</span>}
                {p.isHost && " 👑"}
              </p>
              <p style={{ fontSize: 13, opacity: 0.7 }}>
                {p.online ? "🟢 온라인" : "⚪ 오프라인"} · 🎟️ {p.tickets}장 · 🃏 {p.cardCount}장
              </p>
            </div>
            <div style={{ textAlign: "right", fontSize: 14 }}>
              <p style={{ fontWeight: 700 }}>{yen(p.money)}</p>
              <p style={{ opacity: 0.7 }}>⏱️ {p.minutes}분</p>
            </div>
          </div>
        ))}
        {state.players.length < 3 && (
          <p style={{ fontSize: 13, opacity: 0.6, textAlign: "center" }}>
            빈 자리 {3 - state.players.length}개 · 위의 초대 버튼으로 친구를 불러요
          </p>
        )}
      </div>
    </Sheet>
  );
}

// 남은 캡슐 수는 보여 주지 않는다. 공은 항상 가득 찬 장식.
function GachaMachine({ spinning }: { spinning: boolean }) {
  return (
    <div style={{ position: "relative", width: 220, margin: "0 auto" }}>
      <div
        style={{
          position: "relative",
          width: 220,
          height: 200,
          borderRadius: "50% 50% 12px 12px",
          background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), rgba(255,255,255,.08) 60%)",
          border: "4px solid rgba(255,255,255,.25)",
          overflow: "hidden",
          animation: spinning ? "bg-shake .18s linear infinite" : undefined,
        }}
      >
        {BALL_POSITIONS.map(([x, y], i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 40,
              height: 40,
              marginLeft: -20,
              marginTop: -20,
              borderRadius: "50%",
              background: `linear-gradient(180deg, ${BALL_COLORS[i]} 50%, #fff 50%)`,
              boxShadow: "inset -3px -3px 6px rgba(0,0,0,.2)",
              animation: spinning ? `bg-bounce ${0.3 + (i % 3) * 0.1}s ease-in-out infinite alternate` : undefined,
            }}
          />
        ))}
      </div>
      <div
        style={{
          height: 90,
          marginTop: -4,
          borderRadius: "0 0 20px 20px",
          background: "linear-gradient(180deg, #e63946, #b5232f)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 22px",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: spinning ? "bg-turn .6s linear infinite" : undefined,
          }}
        >
          <span style={{ width: 30, height: 8, borderRadius: 4, background: "#b5232f" }} />
        </div>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: 0.5, whiteSpace: "nowrap" }}>🎂 GACHA</p>
      </div>
    </div>
  );
}

function RevealOverlay({ result, onClose }: { result: DrawnResult; onClose: () => void }) {
  const meta = GRADE_META[result.grade];
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 24,
      }}
    >
      <div style={{ position: "relative", width: 160, height: 160 }}>
        <span style={{ ...capsuleHalf, top: 0, borderRadius: "80px 80px 0 0", background: meta.color, animation: "bg-open-top .6s ease-out forwards" }} />
        <span style={{ ...capsuleHalf, bottom: 0, borderRadius: "0 0 80px 80px", background: "#fff", animation: "bg-open-bottom .6s ease-out forwards" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            animation: "bg-pop .5s .45s ease-out both",
            filter: `drop-shadow(0 0 24px ${meta.color})`,
          }}
        >
          {meta.emoji}
        </div>
      </div>
      <div style={{ textAlign: "center", animation: "bg-pop .5s .6s ease-out both" }}>
        <p style={{ fontSize: 40, fontWeight: 900, color: meta.color, textShadow: `0 0 20px ${meta.color}` }}>{meta.label}</p>
        <p style={{ fontSize: 32, fontWeight: 800, marginTop: 4 }}>{yen(result.amount)}</p>
        <p style={{ fontSize: 18, opacity: 0.85 }}>⏱️ 쇼핑 시간 +{result.minutes}분</p>
      </div>
      <button
        onClick={onClose}
        style={{ ...primaryButton, width: 200, animation: "bg-pop .4s .9s ease-out both" }}
      >
        확인
      </button>
    </div>
  );
}

const capsuleHalf: CSSProperties = { position: "absolute", left: 0, width: 160, height: 80 };

const smallButton: CSSProperties = {
  padding: "7px 12px",
  borderRadius: 10,
  border: "none",
  background: "rgba(255,255,255,.14)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const primaryButton: CSSProperties = {
  padding: "16px 24px",
  borderRadius: 16,
  border: "none",
  background: "#FEE500",
  color: "#191919",
  fontSize: 18,
  fontWeight: 800,
  cursor: "pointer",
};

type PublicQuiz = { id: string; question: string; choices: string[] };
type AnswerResult = { correct: boolean; answer: number; card: CardType | null };

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}

function QuizCard({ quiz, now, onOpen }: { quiz: QuizStatus; now: number; onOpen: () => void }) {
  const label = quizWindowLabel(new Date(quiz.windowStart).getTime());
  const box: CSSProperties = {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,.06)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
  if (quiz.eligible) {
    return (
      <section style={{ ...box, border: "1px solid rgba(254,229,0,.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={{ fontWeight: 700 }}>🧩 {label} 퀴즈가 열렸어요!</p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>
            마감까지 {formatCountdown(new Date(quiz.windowEnd).getTime() - now)}
          </p>
        </div>
        <p style={{ fontSize: 13, opacity: 0.7 }}>맞히면 🃏 특수카드 1장 · 이 구간에 한 번만 풀 수 있어요</p>
        <button onClick={onOpen} style={{ ...primaryButton, padding: "12px 16px", fontSize: 16 }}>
          {quiz.hasOpenQuestion ? "이어서 풀기" : "퀴즈 풀기"}
        </button>
      </section>
    );
  }
  const next = quiz.nextAvailableAt ? new Date(quiz.nextAvailableAt).getTime() : now;
  return (
    <section style={box}>
      <p style={{ fontWeight: 700 }}>✅ {label} 퀴즈 참여 완료</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p style={{ fontSize: 14, opacity: 0.75 }}>다음 퀴즈까지</p>
        <p style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatCountdown(next - now)}</p>
      </div>
      {quiz.lastParticipatedAt && (
        <p style={{ fontSize: 12, opacity: 0.6 }}>
          마지막 참여 {clockTime(quiz.lastParticipatedAt)} · {quiz.nextAvailableAt && `${clockTime(quiz.nextAvailableAt)}부터 다시 가능`}
        </p>
      )}
    </section>
  );
}

function QuizSheet({
  quiz,
  result,
  submitting,
  onAnswer,
  onClose,
}: {
  quiz: PublicQuiz | null;
  result: AnswerResult | null;
  submitting: boolean;
  onAnswer: (choice: number) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="🧩 특수카드 퀴즈" onClose={onClose}>
      {!quiz ? (
        <p style={{ opacity: 0.6 }}>문제를 불러오는 중…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>{quiz.question}</p>
          {quiz.choices.map((c, i) => {
            const isAnswer = result && i === result.answer;
            return (
              <button
                key={i}
                disabled={!!result || submitting}
                onClick={() => onAnswer(i)}
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: `2px solid ${isAnswer ? "#22c55e" : "rgba(255,255,255,.15)"}`,
                  background: isAnswer ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.05)",
                  color: "#fff",
                  fontSize: 16,
                  textAlign: "left",
                  cursor: result ? "default" : "pointer",
                }}
              >
                {["①", "②", "③", "④"][i]} {c}
              </button>
            );
          })}
          {result && (
            <div style={{ textAlign: "center", padding: 12, animation: "bg-pop .4s ease-out both" }}>
              <p style={{ fontSize: 22, fontWeight: 800 }}>{result.correct ? "🎉 정답!" : "😢 아쉽게 오답"}</p>
              <p style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
                {result.correct && result.card
                  ? `${CARD_META[result.card].emoji} ${CARD_META[result.card].name} 카드를 받았어요`
                  : "다음 구간에 다시 도전해요"}
              </p>
              <button onClick={onClose} style={{ ...primaryButton, marginTop: 12, width: "100%" }}>
                확인
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  return `${Math.floor(s / 3600)}시간 전`;
}

export default function GameView({ code }: { code: string }) {
  const [state, setState] = useState<GameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DrawnResult | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const notify = useCallback((title: string, extra: Omit<Notice, "key" | "title"> = {}) => {
    setNotice({ key: Date.now(), title, ...extra });
  }, []);
  // 이미 본 뽑기 기록. 새로 생긴 남의 뽑기만 알림으로 띄운다.
  const seenSlotsRef = useRef<Set<number> | null>(null);
  const [sheet, setSheet] = useState<"rules" | "players" | "quiz" | null>(null);
  const [quizData, setQuizData] = useState<PublicQuiz | null>(null);
  const [quizResult, setQuizResult] = useState<AnswerResult | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  // 서버 시각과 내 폰 시각 차이. 남은 시간은 서버 시각 기준으로 센다.
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/birthday-gacha/games/${code}`, { cache: "no-store" });
      if (res.status === 404) return setLoadError("없는 방이에요. 코드를 다시 확인해 주세요.");
      if (!res.ok) return;
      const data = (await res.json()) as GameState;
      const seen = seenSlotsRef.current;
      if (seen) {
        const fresh = data.drawn.filter((d) => !seen.has(d.slot) && d.drawnBy !== data.me);
        const latest = fresh[0];
        if (latest) {
          const who = data.players.find((p) => p.kakaoId === latest.drawnBy)?.nickname ?? "누군가";
          const meta = GRADE_META[latest.grade];
          notify(`${who}님이 ${meta.label}을 뽑았어요`, {
            emoji: meta.emoji,
            sub: `${yen(latest.amount)} · ${latest.minutes}분`,
            color: meta.color,
          });
        }
      }
      seenSlotsRef.current = new Set(data.drawn.map((d) => d.slot));
      setState(data);
      setClockOffset(new Date(data.serverNow).getTime() - Date.now());
      setLoadError(null);
    } catch {
      // 다음 주기에 다시 시도
    }
  }, [code, notify]);

  useEffect(() => {
    load();
    const id = setInterval(load, GAME_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice]);

  const join = async () => {
    const res = await fetch(`/api/birthday-gacha/games/${code}/join`, { method: "POST" });
    const data = (await res.json()) as { result: string };
    if (data.result === "full") notify("방이 꽉 찼어요 (3명).");
    await load();
  };

  const draw = async () => {
    if (phase !== "idle") return;
    setPhase("spinning");
    const started = Date.now();
    const res = await fetch(`/api/birthday-gacha/games/${code}/draw`, { method: "POST" }).catch(() => null);
    const data = res ? ((await res.json()) as { ok: boolean; capsule?: DrawnResult; reason?: string }) : null;
    // 결과가 빨리 와도 기계 돌아가는 연출은 보여 준다
    await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (Date.now() - started))));
    if (!data?.ok || !data.capsule) {
      setPhase("idle");
      notify(DRAW_ERRORS[data?.reason ?? ""] ?? "뽑기에 실패했어요. 다시 눌러 주세요.");
      return;
    }
    setResult(data.capsule);
    setPhase("reveal");
    if (data.capsule.grade === "SSR" || data.capsule.grade === "SR") {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: data.capsule.grade === "SSR" ? 220 : 90, spread: 90, origin: { y: 0.45 }, zIndex: 70 });
    }
    load();
  };

  // 뽑기 기록을 누르면 그 캡슐 여는 연출을 다시 보여 준다
  const replay = async (d: DrawnResult) => {
    if (phase !== "idle") return;
    setResult({ grade: d.grade, amount: d.amount, minutes: d.minutes });
    setPhase("reveal");
    if (d.grade === "SSR" || d.grade === "SR") {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: d.grade === "SSR" ? 220 : 90, spread: 90, origin: { y: 0.45 }, zIndex: 70 });
    }
  };

  const openQuiz = async () => {
    setQuizData(null);
    setQuizResult(null);
    setSheet("quiz");
    const res = await fetch(`/api/birthday-gacha/games/${code}/quiz`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    }).catch(() => null);
    const data = res ? ((await res.json()) as { ok: boolean; quiz?: PublicQuiz; reason?: string }) : null;
    if (!data?.ok || !data.quiz) {
      setSheet(null);
      notify(data?.reason === "already" ? "이번 구간은 이미 참여했어요." : "퀴즈를 불러오지 못했어요.");
      load();
      return;
    }
    setQuizData(data.quiz);
  };

  const answerQuiz = async (choice: number) => {
    if (quizSubmitting || quizResult) return;
    setQuizSubmitting(true);
    const res = await fetch(`/api/birthday-gacha/games/${code}/quiz`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "answer", choice }),
    }).catch(() => null);
    const data = res ? ((await res.json()) as { ok: boolean; reason?: string } & Partial<AnswerResult>) : null;
    setQuizSubmitting(false);
    if (!data?.ok) {
      setSheet(null);
      notify(data?.reason === "no_question" ? "구간이 바뀌었어요. 새 퀴즈를 열어 주세요." : "이미 참여했어요.");
    } else {
      setQuizResult({ correct: !!data.correct, answer: data.answer ?? -1, card: data.card ?? null });
      if (data.correct) {
        const confetti = (await import("canvas-confetti")).default;
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, zIndex: 70 });
      }
    }
    load();
  };

  const invite = async () => {
    const url = `${location.origin}/birthday-gacha/g/${code}`;
    const text = "🎂 생일 가챠에 초대할게! 카카오로 로그인하고 들어와";
    try {
      if (navigator.share) {
        await navigator.share({ title: "생일 가챠", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      notify("초대 링크를 복사했어요.");
    } catch {
      // 공유 창을 닫은 경우
    }
  };

  const me: GamePlayer | undefined = state?.players.find((p) => p.kakaoId === state.me);
  const onlineCount = state?.players.filter((p) => p.online).length ?? 0;
  const nameOf = (id: string) => state?.players.find((p) => p.kakaoId === id);

  return (
    <div style={{ position: "absolute", inset: 0, overflowY: "auto", color: "#fff", fontFamily: "sans-serif" }}>
      <style>{`
        @keyframes bg-shake { 0%{transform:translate(0,0) rotate(0)} 25%{transform:translate(-3px,1px) rotate(-1.5deg)} 50%{transform:translate(2px,-1px) rotate(1deg)} 75%{transform:translate(-1px,2px) rotate(-1deg)} 100%{transform:translate(0,0) rotate(0)} }
        @keyframes bg-bounce { from{transform:translateY(0)} to{transform:translateY(-14px)} }
        @keyframes bg-turn { to{transform:rotate(360deg)} }
        @keyframes bg-open-top { 0%{transform:translateY(0)} 60%{transform:translateY(-6px) rotate(-4deg)} 100%{transform:translateY(-70px) rotate(-18deg);opacity:0} }
        @keyframes bg-open-bottom { 0%{transform:translateY(0)} 60%{transform:translateY(6px)} 100%{transform:translateY(70px);opacity:0} }
        @keyframes bg-pop { from{transform:scale(.3);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes bg-slide-up { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes bg-notice { 0%{opacity:0;transform:scale(.85)} 10%{opacity:1;transform:scale(1.03)} 16%{transform:scale(1)} 82%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(.96)} }
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* 상단 바 */}
        <header style={stickyHeaderStyle}>
          <Link href={state?.roomCode ? `/r/${state.roomCode}` : "/"} aria-label="방으로" style={{ ...iconButton, display: "flex", alignItems: "center", justifyContent: "center" }}>
            ←
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 17, fontWeight: 800 }}>🎂 생일 가챠</p>
            <button onClick={invite} style={{ background: "none", border: "none", color: "#FEE500", fontSize: 13, padding: 0, cursor: "pointer" }}>
              방 {code} · 초대하기 ↗
            </button>
          </div>
          <button onClick={() => setSheet("rules")} aria-label="규칙" style={iconButton}>
            📜
          </button>
          <button onClick={() => setSheet("players")} aria-label="플레이어" style={iconButton}>
            👥
            {state && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  minWidth: 18,
                  height: 18,
                  padding: "0 4px",
                  borderRadius: 9,
                  background: "#22c55e",
                  color: "#000",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: "18px",
                }}
              >
                {onlineCount}
              </span>
            )}
          </button>
          {roomMapHref(state?.roomCode) && (
            <Link href={roomMapHref(state?.roomCode) as string} aria-label="지도" style={{ ...iconButton, display: "flex", alignItems: "center", justifyContent: "center" }}>
            🗺️
          </Link>
          )}
        </header>

        {loadError && <p style={{ color: "#f97316" }}>{loadError}</p>}
        {!state && !loadError && <p style={{ opacity: 0.6 }}>불러오는 중…</p>}

        {state && !state.isMember && (
          <div style={{ textAlign: "center", padding: 24, borderRadius: 16, background: "rgba(255,255,255,.05)" }}>
            <p style={{ marginBottom: 12 }}>
              {state.players.length >= 3 ? "이 방은 꽉 찼어요 (3명)." : `${state.players.length}명이 기다리고 있어요.`}
            </p>
            {state.players.length < 3 && (
              <button onClick={join} style={primaryButton}>
                🎉 참가하기
              </button>
            )}
          </div>
        )}

        {/* 접속 중인 사람 */}
        {state && (
          <button
            onClick={() => setSheet("players")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#fff", padding: 0, cursor: "pointer" }}
          >
            {state.players.map((p) => (
              <Avatar key={p.kakaoId} src={p.image} size={30} online={p.online} />
            ))}
            <span style={{ fontSize: 13, opacity: 0.7, marginLeft: 4 }}>
              {onlineCount}명 온라인 · {state.players.length}/3
            </span>
          </button>
        )}

        {/* 내 상태 */}
        {me && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { label: "💴 금액", value: yen(me.money) },
              { label: "⏱️ 시간", value: `${me.minutes}분` },
              { label: "🎟️ 뽑기권", value: `${me.tickets}장` },
              { label: "🃏 카드", value: `${state?.myCards.length ?? 0}장` },
            ].map((s) => (
              <div key={s.label} style={{ padding: "10px 6px", borderRadius: 14, background: "rgba(255,255,255,.06)", textAlign: "center" }}>
                <p style={{ fontSize: 11, opacity: 0.7 }}>{s.label}</p>
                <p style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{s.value}</p>
              </div>
            ))}
          </section>
        )}

        {/* 뽑기권 퀴즈 */}
        {me && state?.quiz && <QuizCard quiz={state.quiz} now={now + clockOffset} onOpen={openQuiz} />}

        {/* 푸시 알림 */}
        {me && <InstallCard onNotice={notify} buttonStyle={smallButton} />}
        {me && <PushCard code={code} onNotice={notify} buttonStyle={smallButton} />}

        {/* 내 특수카드 */}
        {me && state && state.myCards.length > 0 && (
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🃏 내 특수카드</h2>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {state.myCards.map((c) => (
                <div
                  key={c.id}
                  style={{
                    flex: "0 0 132px",
                    padding: 12,
                    borderRadius: 14,
                    background: "linear-gradient(160deg, rgba(254,229,0,.18), rgba(255,255,255,.04))",
                    border: "1px solid rgba(254,229,0,.35)",
                  }}
                >
                  <p style={{ fontSize: 28 }}>{CARD_META[c.type].emoji}</p>
                  <p style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{CARD_META[c.type].name}</p>
                  <p style={{ fontSize: 11, opacity: 0.7, marginTop: 4, lineHeight: 1.4 }}>{CARD_META[c.type].desc}</p>
                  <p style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>사용은 곧 열려요</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 가챠 기계 */}
        {state && (
          <section style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "stretch" }}>
            <GachaMachine spinning={phase === "spinning"} />
            {me && (
              <button
                onClick={draw}
                disabled={phase !== "idle" || me.tickets <= 0 || state.remainingCapsules <= 0}
                style={{
                  ...primaryButton,
                  opacity: phase !== "idle" || me.tickets <= 0 || state.remainingCapsules <= 0 ? 0.4 : 1,
                }}
              >
                {phase === "spinning"
                  ? "두근두근…"
                  : state.remainingCapsules <= 0
                    ? "캡슐이 다 떨어졌어요"
                    : me.tickets <= 0
                      ? "뽑기권이 없어요"
                      : `🎟️ 뽑기 (뽑기권 ${me.tickets}장)`}
              </button>
            )}
          </section>
        )}

        {/* 뽑기 기록 */}
        {state && (
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              📣 뽑기 기록 <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.5 }}>누르면 연출을 다시 봐요</span>
            </h2>
            {state.drawn.length === 0 && <p style={{ fontSize: 14, opacity: 0.6 }}>아직 아무도 안 뽑았어요.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.drawn.map((d) => {
                const who = nameOf(d.drawnBy);
                const meta = GRADE_META[d.grade];
                return (
                  <button
                    key={d.slot}
                    onClick={() => replay(d)}
                    aria-label="뽑기 연출 다시 보기"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      borderRadius: 12,
                      background: "rgba(255,255,255,.04)",
                      border: "none",
                      color: "#fff",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <Avatar src={who?.image ?? null} size={30} />
                    <p style={{ flex: 1, fontSize: 14 }}>
                      <b>{who?.nickname ?? "?"}</b>{" "}
                      <span style={{ color: meta.color, fontWeight: 800 }}>
                        {meta.emoji} {meta.label}
                      </span>{" "}
                      {yen(d.amount)} · {d.minutes}분
                    </p>
                    <span style={{ fontSize: 12, opacity: 0.5 }}>{timeAgo(d.drawnAt)} ▶</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {notice && (
        <div
          key={notice.key}
          role="status"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            padding: 24,
          }}
        >
          <div
            style={{
              minWidth: 220,
              maxWidth: 320,
              padding: notice.emoji ? "24px 28px" : "18px 24px",
              borderRadius: 24,
              background: "rgba(28,28,30,.94)",
              boxShadow: `0 12px 40px rgba(0,0,0,.5)${notice.color ? `, 0 0 0 1px ${notice.color}55` : ""}`,
              backdropFilter: "blur(12px)",
              textAlign: "center",
              animation: `bg-notice ${NOTICE_MS}ms ease forwards`,
            }}
          >
            {notice.emoji && (
              <p style={{ fontSize: 44, lineHeight: 1, marginBottom: 10, filter: notice.color ? `drop-shadow(0 0 12px ${notice.color})` : undefined }}>
                {notice.emoji}
              </p>
            )}
            <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>{notice.title}</p>
            {notice.sub && (
              <p style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: notice.color ?? "#fff" }}>{notice.sub}</p>
            )}
          </div>
        </div>
      )}
      {sheet === "rules" && <RulesSheet onClose={() => setSheet(null)} />}
      {sheet === "players" && state && <PlayersSheet state={state} onClose={() => setSheet(null)} />}
      {sheet === "quiz" && (
        <QuizSheet
          quiz={quizData}
          result={quizResult}
          submitting={quizSubmitting}
          onAnswer={answerQuiz}
          onClose={() => setSheet(null)}
        />
      )}
      {phase === "reveal" && result && (
        <RevealOverlay
          result={result}
          onClose={() => {
            setPhase("idle");
            setResult(null);
          }}
        />
      )}
    </div>
  );
}
