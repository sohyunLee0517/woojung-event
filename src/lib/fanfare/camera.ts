// 호스트 카메라 열기. 안 열리면 더 단순한 설정으로 다시 시도하고, 원인을 한국어로 알려 준다.

type GetUserMedia = (c: MediaStreamConstraints) => Promise<MediaStream>;

const ATTEMPTS: MediaStreamConstraints[] = [
  {
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  },
  { video: true, audio: true },
  { video: true, audio: false },
];

const RETRYABLE = new Set(["NotReadableError", "OverconstrainedError", "AbortError", "TrackStartError"]);

export async function openCameraWith(gum: GetUserMedia): Promise<MediaStream> {
  let last: unknown;
  for (const c of ATTEMPTS) {
    try {
      return await gum(c);
    } catch (e) {
      last = e;
      if (!RETRYABLE.has((e as Error)?.name)) throw e;
    }
  }
  throw last;
}

export function cameraErrorMessage(e: unknown): string {
  switch ((e as Error)?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "카메라 권한이 막혀 있어요. 주소창 왼쪽 자물쇠 → 카메라·마이크를 '허용'으로 바꿔 주세요.";
    case "NotReadableError":
    case "TrackStartError":
      return "카메라를 다른 앱(줌·페이스타임 등)이나 다른 탭이 쓰고 있는 것 같아요. 닫고 다시 켜 주세요. 맥이라면 시스템 설정 → 개인정보 보호 및 보안 → 카메라에서 Chrome 을 켜 주세요.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "이 기기에서 카메라를 찾을 수 없어요. 노트북 덮개를 닫고 외부 모니터를 쓰는 중이면 내장 카메라가 꺼져 있어요. 덮개를 열거나 휴대폰으로 호스트를 해 주세요.";
    default:
      return "카메라를 켤 수 없어요. 잠시 후 다시 시도해 주세요.";
  }
}
