/**
 * 보류한 기능(레거시). 코드는 남겨 두고 스위치로 끈다. true 로 바꾸면 다시 살아난다.
 *   quizCards: 2시간마다 퀴즈 → 특수카드(강탈·방패·반사) · 퀴즈 푸시
 *   mapAttack: 지도의 '⚔️ 공격 가능' · 야외 정확도 조건
 * 2026-11-26 까지 다시 켜지 않으면 코드와 DB(quiz_attempts, player_cards)를 정리한다.
 */
export const LEGACY = {
  quizCards: false,
  mapAttack: false,
} as const;
