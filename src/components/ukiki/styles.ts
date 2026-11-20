import type { CSSProperties } from "react";

// 우끼끼 공통 색·버튼
export const UK = {
  yellow: "#FEE500",
  card: "rgba(255,255,255,.06)",
  line: "rgba(255,255,255,.12)",
};

export const pageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflowY: "auto",
  color: "#fff",
  fontFamily: "sans-serif",
};

export const columnStyle: CSSProperties = {
  maxWidth: 480,
  margin: "0 auto",
  padding: "20px 16px 48px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

/** 화면은 고정하고 리스트 안에서만 스크롤할 때 */
export const fixedPageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  color: "#fff",
  fontFamily: "sans-serif",
};

export const fixedColumnStyle: CSSProperties = {
  maxWidth: 480,
  height: "100%",
  margin: "0 auto",
  padding: "16px 16px 0",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

export const scrollAreaStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  paddingBottom: 32,
  overscrollBehavior: "contain",
};

export const primaryButton: CSSProperties = {
  padding: "14px 18px",
  borderRadius: 14,
  border: "none",
  background: UK.yellow,
  color: "#191919",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "center",
};

export const ghostButton: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "rgba(255,255,255,.12)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "center",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${UK.line}`,
  background: "transparent",
  color: "#fff",
  fontSize: 16,
};

export const GAME_META = {
  fanfare: { emoji: "🌡️", label: "우정의 온도", desc: "다 같이 눌러서 우정 온도 100도 만들기" },
  gacha: { emoji: "🎰", label: "생일 가챠", desc: "캡슐을 뽑아 등급별 선물 받기" },
  pirate: { emoji: "🏴‍☠️", label: "해적 무찌르기", desc: "돌아가며 칼을 꽂아요. 해적이 튀어나오면 실패!" },
  snack: { emoji: "🍪", label: "과자 나눠먹기", desc: "각자 몰래 잘라 가요. 합이 100을 넘으면 실패!" },
  pinball: { emoji: "🎱", label: "랜덤 핀볼", desc: "구슬을 굴려 1등이 오늘의 주인공!" },
  ai: { emoji: "🤖", label: "우리가 만든 게임", desc: "방 친구가 AI로 만든 게임을 같이 해요" },
} as const;
