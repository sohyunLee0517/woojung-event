import type { CSSProperties } from "react";
import { UK } from "./styles";

// 공통 토글 스위치 (켜짐/꺼짐).
//   폼 안(서버 액션): <Toggle submit checked={on} label="생일 가챠" />  → 누르면 폼 제출
//   화면 안(클라이언트): <Toggle checked={on} onToggle={() => setOn(!on)} label="소리" />
// 훅을 쓰지 않아서 서버 컴포넌트에서도 그대로 쓸 수 있다 (onToggle 은 클라이언트에서만).

const W = 52;
const H = 30;
const KNOB = 24;

export default function Toggle({
  checked,
  label,
  onToggle,
  submit = false,
  disabled = false,
  style,
}: {
  checked: boolean;
  /** 읽기 도구가 읽어 줄 이름 (예: "생일 가챠") */
  label: string;
  onToggle?: () => void;
  /** 폼 제출 버튼으로 쓸 때 */
  submit?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type={submit ? "submit" : "button"}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      style={{
        position: "relative",
        flex: "0 0 auto",
        width: W,
        height: H,
        padding: 0,
        borderRadius: H / 2,
        border: "none",
        background: checked ? UK.yellow : "rgba(255,255,255,.18)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background .2s",
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: (H - KNOB) / 2,
          left: checked ? W - KNOB - (H - KNOB) / 2 : (H - KNOB) / 2,
          width: KNOB,
          height: KNOB,
          borderRadius: "50%",
          background: checked ? "#191919" : "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.35)",
          transition: "left .2s, background .2s",
        }}
      />
    </button>
  );
}
