export type EventStatus =
  | "WAITING"      // 대기 중
  | "PLAYING"      // 게임 진행 중 (온도 상승)
  | "CELEBRATION"  // 100도 달성! 폭죽
  | "RANKING"      // 탭 순위 발표
  | "BLACKOUT"     // 암전
  | "REVEAL"       // 주최자 영상 공개
  | "ABORTED";     // 게임 중단 (이탈자 발생)

export interface EventState {
  status: EventStatus;
  temperature: number; // 0 ~ 100, 0.1 단위
}

export interface WebRTCSessionData {
  joined?: boolean;
  offer?: { type: RTCSdpType; sdp: string };
  answer?: { type: RTCSdpType; sdp: string };
  hostCandidates?: Record<string, RTCIceCandidateInit>;
  viewerCandidates?: Record<string, RTCIceCandidateInit>;
}
