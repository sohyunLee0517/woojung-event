// 빵빠레 영상 연결 (호스트 카메라 → 친구들, 1:N, Firebase 시그널링)
//
//   rtc/{epoch}/{viewerKey}/joined      친구가 "영상 주세요" 표시 (끊기면 자동 삭제)
//   rtc/{epoch}/{viewerKey}/offer       호스트 → 친구
//   rtc/{epoch}/{viewerKey}/answer      친구 → 호스트
//   rtc/{epoch}/{viewerKey}/hc/*  vc/*  ICE 후보 (호스트/친구)
//
// - 호스트가 새로고침하거나 카메라를 다시 켜면 epoch 가 바뀌고, 친구들은 새 epoch 로 다시 연결한다.
// - 친구가 나가면(노드 삭제) 호스트는 그 연결을 닫는다.
// - 연결이 실패하면 친구 쪽이 새 키로 다시 요청한다.
import { onChildAdded, onChildRemoved, onDisconnect, onValue, push, remove, set, type Unsubscribe } from "firebase/database";
import { pathRef, watchHost } from "@/lib/fanfare/store";
import { IceQueue } from "@/lib/fanfare/ice-queue";
import { openCameraWith } from "@/lib/fanfare/camera";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};
const VIDEO_MAX_BITRATE_BPS = 3_500_000;
const AUDIO_MAX_BITRATE_BPS = 128_000;
const RETRY_MS = 2500;

async function applyOutgoingBitrate(pc: RTCPeerConnection) {
  for (const sender of pc.getSenders()) {
    if (!sender.track) continue;
    try {
      const params = sender.getParameters();
      const enc = params.encodings?.[0] ? { ...params.encodings[0] } : ({} as RTCRtpEncodingParameters);
      if (sender.track.kind === "video") {
        enc.maxBitrate = VIDEO_MAX_BITRATE_BPS;
        enc.maxFramerate = 30;
      } else enc.maxBitrate = AUDIO_MAX_BITRATE_BPS;
      params.encodings = [enc, ...(params.encodings?.slice(1) ?? [])];
      await sender.setParameters(params);
    } catch {
      // 일부 브라우저에서는 실패할 수 있다
    }
  }
}

export function openCamera(): Promise<MediaStream> {
  return openCameraWith((c) => navigator.mediaDevices.getUserMedia(c));
}

// ─── 호스트 ───────────────────────────────────────────────────────────────
export class FanfareHost {
  private peers = new Map<string, { pc: RTCPeerConnection; unsubs: Unsubscribe[] }>();
  private unsubs: Unsubscribe[] = [];

  constructor(
    private gameId: number,
    private epoch: number,
    private stream: MediaStream,
  ) {}

  private sub(key: string) {
    return `rtc/${this.epoch}/${key}`;
  }

  start() {
    const root = pathRef(this.gameId, `rtc/${this.epoch}`);
    this.unsubs.push(onChildAdded(root, (snap) => void this.connect(snap.key as string)));
    this.unsubs.push(onChildRemoved(root, (snap) => this.closePeer(snap.key as string)));
  }

  private async connect(key: string) {
    if (this.peers.has(key)) return;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const unsubs: Unsubscribe[] = [];
    this.peers.set(key, { pc, unsubs });
    this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) void push(pathRef(this.gameId, `${this.sub(key)}/hc`), e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.closePeer(key);
    };

    const queue = new IceQueue((c) => pc.addIceCandidate(c));
    unsubs.push(onChildAdded(pathRef(this.gameId, `${this.sub(key)}/vc`), (s) => void queue.add(s.val())));
    unsubs.push(
      onValue(pathRef(this.gameId, `${this.sub(key)}/answer`), async (s) => {
        const answer = s.val() as RTCSessionDescriptionInit | null;
        if (!answer || pc.currentRemoteDescription) return;
        await pc.setRemoteDescription(answer);
        await queue.ready();
      }),
    );

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await set(pathRef(this.gameId, `${this.sub(key)}/offer`), { type: offer.type, sdp: offer.sdp });
    await applyOutgoingBitrate(pc);
  }

  private closePeer(key: string) {
    const p = this.peers.get(key);
    if (!p) return;
    p.unsubs.forEach((u) => u());
    p.pc.close();
    this.peers.delete(key);
  }

  get viewerCount() {
    return this.peers.size;
  }

  /** 모든 연결을 닫고 이번 epoch 의 시그널링 데이터를 지운다 */
  async stop() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    [...this.peers.keys()].forEach((k) => this.closePeer(k));
    await remove(pathRef(this.gameId, `rtc/${this.epoch}`)).catch(() => {});
  }
}

// ─── 친구(시청자) ─────────────────────────────────────────────────────────
export class FanfareViewer {
  private pc: RTCPeerConnection | null = null;
  private unsubs: Unsubscribe[] = [];
  private hostUnsub: Unsubscribe | null = null;
  private epoch: number | null = null;
  private key: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private gameId: number,
    private me: string,
    private onStream: (s: MediaStream | null) => void,
  ) {}

  /** 호스트 epoch 를 지켜보다가 바뀌면 그 epoch 로 다시 연결한다 */
  start() {
    this.hostUnsub = watchHost(this.gameId, (h) => {
      if (this.stopped) return;
      if (!h || !h.online) {
        this.teardown();
        this.epoch = null;
        this.onStream(null);
        return;
      }
      if (h.epoch !== this.epoch) {
        this.epoch = h.epoch;
        void this.connect();
      }
    });
  }

  private teardown() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.pc?.close();
    this.pc = null;
    if (this.epoch !== null && this.key) void remove(pathRef(this.gameId, `rtc/${this.epoch}/${this.key}`)).catch(() => {});
    this.key = null;
  }

  private scheduleRetry() {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, RETRY_MS);
  }

  private async connect() {
    this.teardown();
    if (this.epoch === null || this.stopped) return;
    const epoch = this.epoch;
    const key = `${this.me}-${Math.random().toString(36).slice(2, 8)}`;
    this.key = key;
    const base = `rtc/${epoch}/${key}`;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pc = pc;
    pc.ontrack = (e) => this.onStream(e.streams[0] ?? null);
    pc.onicecandidate = (e) => {
      if (e.candidate) void push(pathRef(this.gameId, `${base}/vc`), e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      if (pc.connectionState === "failed") this.scheduleRetry();
    };

    const queue = new IceQueue((c) => pc.addIceCandidate(c));
    this.unsubs.push(onChildAdded(pathRef(this.gameId, `${base}/hc`), (s) => void queue.add(s.val())));
    this.unsubs.push(
      onValue(pathRef(this.gameId, `${base}/offer`), async (s) => {
        const offer = s.val() as RTCSessionDescriptionInit | null;
        if (!offer || pc.currentRemoteDescription || pc !== this.pc) return;
        await pc.setRemoteDescription(offer);
        await queue.ready();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await set(pathRef(this.gameId, `${base}/answer`), { type: answer.type, sdp: answer.sdp });
      }),
    );

    const joinedRef = pathRef(this.gameId, `${base}/joined`);
    await onDisconnect(pathRef(this.gameId, base)).remove();
    await set(joinedRef, true);

    // 10초 안에 연결이 안 되면 다시 시도
    setTimeout(() => {
      if (pc === this.pc && pc.connectionState !== "connected") this.scheduleRetry();
    }, 10_000);
  }

  stop() {
    this.stopped = true;
    this.hostUnsub?.();
    this.teardown();
  }
}
