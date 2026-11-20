"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TopBar from "@/components/ukiki/TopBar";
import { ghostButton, inputStyle, pageStyle, columnStyle, primaryButton, UK } from "@/components/ukiki/styles";
import { PROMPT_COST } from "@/lib/bananas/rules";
import { PROMPT_MAX } from "@/lib/game-maker/prompt";
import { AUTOFIX_MAX } from "@/lib/game-maker/smoke";
import { runSmokeTest } from "./smoke-runner";
import type { AiGameEdit } from "@/lib/game-maker/store";
import PreviewPlayground from "./PreviewPlayground";
import { BananaChip } from "./MakerHome";

const PENDING_POLL_MS = 3000;
const EXAMPLES = ["떨어지는 바나나를 가장 많이 받는 사람이 1등", "다 같이 숫자를 1부터 30까지 순서대로 누르는 협동 게임", "돌아가며 폭탄을 넘기다 터지면 지는 게임"];

const CSS = `
@keyframes mk-bounce { 0%,100% { transform: translateY(0) rotate(-6deg) } 50% { transform: translateY(-10px) rotate(6deg) } }
@keyframes mk-dots { to { width: 1.2em } }
`;

// AI 게임 만들기: 프롬프트 → AI가 만들기 → 미리 해 보기 → 프롬프트로 고치기 → 확정
export default function MakerEditor({ roomCode, aiId }: { roomCode: string; aiId: number }) {
  const router = useRouter();
  const api = `/api/ukiki/rooms/${roomCode}/maker/${aiId}`;
  const [game, setGame] = useState<AiGameEdit | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [missing, setMissing] = useState(false);
  const [lowBananas, setLowBananas] = useState(false);
  const [published, setPublished] = useState<{ title: string; emoji: string } | null>(null);
  // 확정할 때: 자동 테스트 → (실패하면) AI 자동 수정 → 다시 테스트
  const [stage, setStage] = useState<string | null>(null);
  const [passedVersion, setPassedVersion] = useState<number | null>(null);
  const [fixedNote, setFixedNote] = useState(false);
  const [testProblems, setTestProblems] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(api, { cache: "no-store" }).catch(() => null);
    if (res?.status === 404) return setMissing(true);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; game: AiGameEdit; balance: number } | null) : null;
    if (!data?.ok) return;
    setGame(data.game);
    setBalance(data.balance);
  }, [api]);
  useEffect(() => void load(), [load]);

  // 새 버전이 생기면 그 버전을 보여 준다
  const versionCount = game?.versions.length ?? 0;
  useEffect(() => {
    if (versionCount) setSelected(game?.versions.at(-1)?.version ?? null);
  }, [versionCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = !!game?.pending;
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, PENDING_POLL_MS);
    return () => clearInterval(t);
  }, [pending, load]);

  const post = async (body: object) => {
    setBusy(true);
    setMessage("");
    const res = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; reason?: string; balance?: number; need?: number } | null) : null;
    setBusy(false);
    return data;
  };

  const ask = async () => {
    if (busy || !prompt.trim()) return;
    // 보내기 전에 잔액 확인: 모자라면 알럿만 (입력·미리보기는 그대로)
    if (balance !== null && balance < PROMPT_COST) return setLowBananas(true);
    const r = await post({ action: "prompt", prompt });
    if (r?.ok) {
      setPrompt("");
      setPassedVersion(null);
      setFixedNote(false);
      setTestProblems([]);
    }
    else if (r?.reason === "bananas") setLowBananas(true);
    else if (r?.reason === "busy") setMessage("AI가 아직 만드는 중이에요. 조금만 기다려 주세요.");
    else if (r?.reason === "not_ready") setMessage("AI 연결을 준비하고 있어요. 조금 뒤에 다시 해 주세요.");
    else if (r?.reason === "disabled") setMessage("지금은 게임 만들기가 쉬고 있어요.");
    else if (r?.reason === "invalid") setMessage(`어떤 게임인지 ${PROMPT_MAX}자 안으로 적어 주세요.`);
    else setMessage("요청을 보내지 못했어요. 다시 해 주세요.");
    await load();
  };

  const fetchGame = async (): Promise<AiGameEdit | null> => {
    const res = await fetch(api, { cache: "no-store" }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { ok: boolean; game: AiGameEdit; balance: number } | null) : null;
    if (!data?.ok) return null;
    setGame(data.game);
    setBalance(data.balance);
    return data.game;
  };

  const doPublish = async (v: { version: number; title: string; emoji: string }) => {
    const r = (await post({ action: "publish", version: v.version })) as { ok: boolean; reason?: string } | null;
    if (r?.ok) setPublished({ title: v.title, emoji: v.emoji });
    else if (r?.reason === "full") setMessage("방 게임이 10개로 가득 찼어요. 내가 만든 게임을 지우면 확정할 수 있어요.");
    else if (r?.reason === "untested") setMessage("자동 테스트를 통과한 버전만 확정할 수 있어요.");
    else setMessage("확정하지 못했어요.");
  };

  const notYet = (problems: string[], text = "아직 게임에 문제가 있어요, 조금 더 설명해서 고쳐 볼까요?") => {
    setStage(null);
    setTestProblems(problems);
    setMessage(text);
  };

  /** 확정: 마지막 버전을 자동 테스트 → 통과하면 방에 올림. 실패하면 AI가 고치고 다시 테스트 (최대 3번, 바나나 없음) */
  const publish = async () => {
    if (busy || stage || !game) return;
    let latest = game.versions.at(-1);
    if (!latest) return;
    if (passedVersion === latest.version) return doPublish(latest);
    setMessage("");
    setTestProblems([]);
    setFixedNote(false);
    let fixed = false;
    for (;;) {
      setStage(fixed ? "🧪 고친 버전을 다시 테스트하는 중…" : "🧪 자동 테스트 중…");
      const r = await runSmokeTest(latest.html);
      await post({ action: "test_result", version: latest.version, ok: r.ok, problems: r.problems });
      if (r.ok) {
        setStage(null);
        if (!fixed) return doPublish(latest);
        // 고친 버전은 확정 전에 한 번 보여 준다
        setPassedVersion(latest.version);
        setFixedNote(true);
        await fetchGame();
        setSelected(latest.version);
        return;
      }
      const left = (await fetchGame())?.autofixLeft ?? 0;
      if (left <= 0) return notYet(r.problems);
      setStage(`🔧 AI가 고치는 중 (${AUTOFIX_MAX - left + 1}/${AUTOFIX_MAX})…`);
      const fx = (await post({ action: "autofix", version: latest.version, problems: r.problems })) as { ok: boolean } | null;
      if (!fx?.ok) return notYet(r.problems);
      const before = latest.version;
      let next: AiGameEdit | null = null;
      for (let i = 0; i < 120; i++) {
        await new Promise((res) => setTimeout(res, 3000));
        const g = await fetchGame();
        if (!g) break;
        if (!g.pending) {
          next = g;
          break;
        }
      }
      const nv = next?.versions.at(-1);
      if (!next || !nv || nv.version === before) return notYet(r.problems, next?.lastError ?? undefined);
      latest = nv;
      fixed = true;
    }
  };

  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = async () => {
    if (busy) return;
    if (!confirmRemove) return setConfirmRemove(true);
    const r = await post({ action: "delete" });
    if (r?.ok) router.push(`/r/${roomCode}/maker`);
  };

  if (published) {
    return (
      <main style={pageStyle}>
        <div style={{ ...columnStyle, gap: 14, alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "70vh" }}>
          <p style={{ fontSize: 56 }}>{published.emoji}</p>
          <p style={{ fontSize: 20, fontWeight: 900 }}>“{published.title}” 확정!</p>
          <p style={{ fontSize: 14, opacity: 0.75 }}>이제 방 친구들과 같이 할 수 있어요.</p>
          <Link href={`/r/${roomCode}/maker`} style={{ ...primaryButton, textDecoration: "none", width: "100%", maxWidth: 320 }}>
            🎮 게임 목록으로
          </Link>
          <Link href={`/r/${roomCode}`} style={{ ...ghostButton, textDecoration: "none", width: "100%", maxWidth: 320 }}>
            방으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  if (missing) {
    return (
      <main style={pageStyle}>
        <div style={columnStyle}>
          <TopBar backHref={`/r/${roomCode}/maker`} title="🤖 게임 만들기" />
          <p style={{ opacity: 0.7 }}>만들던 게임을 찾을 수 없어요. 확정한 게임은 더 고칠 수 없고, 만든 사람만 이어 만들 수 있어요.</p>
        </div>
      </main>
    );
  }
  if (!game) return <main style={pageStyle} />;

  const version = game.versions.find((v) => v.version === selected) ?? game.versions.at(-1) ?? null;
  const first = game.versions.length === 0;
  const canPay = balance !== null && balance >= PROMPT_COST;

  return (
    <main style={pageStyle}>
      <style>{CSS}</style>
      <div style={{ ...columnStyle, gap: 14 }}>
        <TopBar
          backHref={`/r/${roomCode}/maker`}
          title={first ? "✨ 새 게임 만들기" : `${version?.emoji ?? game.emoji} ${version?.title ?? game.title}`}
          right={<BananaChip balance={balance} />}
        />

        {pending && (
          <div style={{ padding: 18, borderRadius: 16, background: UK.card, textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 44, animation: "mk-bounce 1s ease-in-out infinite" }}>🐒</p>
            <p style={{ fontWeight: 800 }}>
              AI가 게임을 {first ? "만드는" : "고치는"} 중
              <span style={{ display: "inline-block", width: 0, overflow: "hidden", verticalAlign: "bottom", animation: "mk-dots 1.2s steps(4) infinite" }}>...</span>
            </p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>“{game.pending?.prompt}”</p>
            <p style={{ fontSize: 12, opacity: 0.5 }}>1~3분쯤 걸려요. 다른 화면에 갔다 와도 계속 만들어요.</p>
          </div>
        )}

        {game.lastError && !pending && <p style={{ padding: 12, borderRadius: 12, background: "rgba(255,90,90,.12)", color: "#ff9a9a", fontSize: 13 }}>😢 {game.lastError}</p>}
        {game.suggestions.length > 0 && !pending && (
          <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,216,77,.08)", border: "1px solid #ffd84d33", display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 800 }}>💡 대신 이런 건 어때요? (바나나는 쓰지 않았어요)</p>
            {game.suggestions.map((sug) => (
              <button key={sug} onClick={() => setPrompt(sug)} style={{ ...ghostButton, textAlign: "left", fontSize: 13 }}>
                {sug}
              </button>
            ))}
            <p style={{ fontSize: 12, opacity: 0.6 }}>고르면 아래 칸에 들어가요. 고치거나 새로 적어서 보내면 그때 만들어요.</p>
          </div>
        )}

        {version && !pending && (
          <>
            {game.versions.length > 1 && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {game.versions.map((v) => (
                  <button
                    key={v.version}
                    onClick={() => setSelected(v.version)}
                    style={{
                      flex: "0 0 auto",
                      padding: "6px 12px",
                      borderRadius: 999,
                      fontSize: 13,
                      border: v.version === version.version ? "1px solid #ffd84d" : `1px solid ${UK.line}`,
                      background: v.version === version.version ? "rgba(255,216,77,.15)" : "transparent",
                      color: "#fff",
                    }}
                  >
                    v{v.version}
                  </button>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, opacity: 0.6 }}>
              v{version.version} 요청: “{version.prompt}”
            </p>
            {version.rules && <p style={{ fontSize: 14 }}>📜 {version.rules}</p>}
            <div style={{ height: "62vh", minHeight: 380 }}>
              <PreviewPlayground key={version.version} html={version.html} title={version.title} emoji={version.emoji} />
            </div>
            {fixedNote && passedVersion === version.version && (
              <p style={{ padding: 12, borderRadius: 12, background: "rgba(120,220,120,.12)", color: "#9be59b", fontSize: 13 }}>
                🔧 AI가 문제를 고쳤고 자동 테스트를 통과했어요. 위에서 미리 해 보고 확정해 주세요.
              </p>
            )}
            {stage && (
              <p style={{ padding: 12, borderRadius: 12, background: UK.card, fontSize: 14, fontWeight: 700, textAlign: "center" }}>
                {stage}
                <span style={{ display: "block", fontSize: 12, opacity: 0.6, fontWeight: 400, marginTop: 4 }}>이 화면을 켜 둬 주세요. 바나나는 더 들지 않아요.</span>
              </p>
            )}
            {testProblems.length > 0 && (
              <ul style={{ padding: "10px 12px 10px 28px", borderRadius: 12, background: "rgba(255,90,90,.08)", color: "#ffb0b0", fontSize: 12, lineHeight: 1.6 }}>
                {testProblems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {version.version === game.versions.at(-1)?.version ? (
              <button onClick={publish} disabled={busy || !!stage} style={{ ...primaryButton, opacity: busy || stage ? 0.6 : 1 }}>
                {passedVersion === version.version ? `✅ v${version.version} 확정하기` : `✅ 확정하기 (자동 테스트 후 방에 올려요)`}
              </button>
            ) : (
              <p style={{ fontSize: 12, opacity: 0.6, textAlign: "center" }}>확정은 마지막 버전(v{game.versions.at(-1)?.version})에서 할 수 있어요.</p>
            )}
            <p style={{ fontSize: 12, opacity: 0.55, textAlign: "center", marginTop: -6 }}>확정하면 방 게임이 되고, 더 고칠 수 없어요.</p>
          </>
        )}

        {!pending && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 16, background: UK.card }}>
            <label htmlFor="mk-prompt" style={{ fontWeight: 800 }}>
              {first ? "어떤 게임을 만드시겠습니까?" : "어떻게 고칠까요?"}
            </label>
            <textarea
              id="mk-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={PROMPT_MAX}
              rows={first ? 5 : 3}
              placeholder={first ? `예) ${EXAMPLES[0]}` : "예) 시간을 30초로 줄여 줘, 공을 더 크게 해 줘"}
              style={{ ...inputStyle, resize: "vertical", fontSize: 15 }}
            />
            {first && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => setPrompt(ex)} style={{ ...ghostButton, padding: "6px 10px", fontSize: 12 }}>
                    {ex}
                  </button>
                ))}
              </div>
            )}
            <button onClick={ask} disabled={busy || !prompt.trim()} style={{ ...primaryButton, opacity: busy || !prompt.trim() ? 0.5 : 1 }}>
              🍌 {PROMPT_COST}개 쓰고 {first ? "만들기" : "고치기"}
            </button>
            <p style={{ fontSize: 12, opacity: 0.6 }}>
              내 바나나 {balance ?? "…"}개{!canPay && balance !== null ? ` · ${PROMPT_COST - balance}개 더 모아야 해요` : ""}
            </p>
          </div>
        )}

        {lowBananas && (
          <div
            onClick={() => setLowBananas(false)}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <div role="alertdialog" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, padding: 20, borderRadius: 20, background: "#1c1c1c", display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
              <p style={{ fontSize: 40 }}>🍌</p>
              <p style={{ fontWeight: 800 }}>바나나가 부족해요, 게임해서 더 모아 주세요</p>
              <p style={{ fontSize: 13, opacity: 0.7 }}>
                프롬프트 1번에 {PROMPT_COST}개 · 지금 {balance ?? 0}개
              </p>
              <button onClick={() => setLowBananas(false)} style={primaryButton}>
                알겠어요
              </button>
            </div>
          </div>
        )}

        {message && <p style={{ fontSize: 13, textAlign: "center", color: "#ffd84d" }}>{message}</p>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <Link href={`/r/${roomCode}/maker`} style={{ ...ghostButton, textDecoration: "none" }}>
            목록으로
          </Link>
          {game.status === "draft" && !pending && (
            <button onClick={remove} style={{ ...ghostButton, color: "#ff9a9a" }}>
              {confirmRemove ? "정말 지울까요? (쓴 바나나는 안 돌아와요)" : "지우기"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
