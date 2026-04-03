"use client";

type GameAlertProps = {
  open: boolean;
  title: string;
  lines: string[];
  confirmLabel?: string;
  onConfirm: () => void;
};

export default function GameAlert({
  open,
  title,
  lines,
  confirmLabel = "알겠어요",
  onConfirm,
}: GameAlertProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.72)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-alert-title"
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #1a1410 0%, #0f0f0f 100%)",
          border: "2px solid rgba(249,115,22,0.45)",
          boxShadow:
            "0 0 0 1px rgba(249,115,22,0.15), 0 24px 48px rgba(0,0,0,0.65), 0 0 60px rgba(249,115,22,0.12)",
        }}
      >
        <div
          className="px-6 pt-6 pb-2 text-center"
          style={{
            borderBottom: "1px solid rgba(249,115,22,0.15)",
          }}
        >
          <p className="text-3xl mb-2" aria-hidden>
            🌡️
          </p>
          <h2
            id="game-alert-title"
            className="text-white font-black text-lg tracking-tight"
          >
            {title}
          </h2>
        </div>
        <div className="px-6 py-5 space-y-2">
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-white/75 text-sm text-center leading-relaxed"
            >
              {line}
            </p>
          ))}
        </div>
        <div className="px-6 pb-6 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-4 rounded-2xl font-black text-white text-base active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #f97316, #ef4444)",
              boxShadow: "0 0 28px rgba(249,115,22,0.35)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
