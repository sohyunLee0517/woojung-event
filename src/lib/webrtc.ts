/**
 * WebRTC 1:N 스트리밍 (Firebase RTDB 시그널링)
 *
 * Host → Viewer 단방향 비디오 브로드캐스트.
 * 각 뷰어는 고유 sessionId로 Firebase에 등록 → 호스트가 offer 생성 → 연결 완료.
 */
import { db } from "@/lib/firebase";
import { ref, set, push, onValue, remove } from "firebase/database";

const WEBRTC_PATH = "woojung-webrtc/sessions";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ─── Host ────────────────────────────────────────────────────────────────────

export class HostBroadcaster {
  private pcs = new Map<string, RTCPeerConnection>();
  private stream: MediaStream | null = null;
  private cleanups: Array<() => void> = [];

  async startCamera(): Promise<MediaStream> {
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
    }
    return this.stream;
  }

  /** 뷰어 세션 등록을 감시하고 각 뷰어에게 offer 생성 */
  watchViewers(): void {
    const sessionsRef = ref(db, WEBRTC_PATH);
    const unsub = onValue(sessionsRef, (snap) => {
      if (!snap.exists()) return;
      snap.forEach((child) => {
        const id = child.key!;
        const data = child.val() as { joined?: boolean; offer?: unknown };
        // joined=true이고 아직 offer를 보내지 않은 뷰어만
        if (data.joined && !data.offer && !this.pcs.has(id)) {
          this.connectViewer(id);
        }
      });
    });
    this.cleanups.push(unsub);
  }

  private async connectViewer(sessionId: string): Promise<void> {
    if (!this.stream) return;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pcs.set(sessionId, pc);

    this.stream.getTracks().forEach((track) => pc.addTrack(track, this.stream!));

    // 뷰어의 answer 수신
    const answerRef = ref(db, `${WEBRTC_PATH}/${sessionId}/answer`);
    const unsubAnswer = onValue(answerRef, async (snap) => {
      if (!snap.exists()) return;
      if (pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
      }
    });
    this.cleanups.push(unsubAnswer);

    // 뷰어의 ICE candidates 수신
    const viewerCandRef = ref(db, `${WEBRTC_PATH}/${sessionId}/viewerCandidates`);
    const unsubCand = onValue(viewerCandRef, (snap) => {
      if (!snap.exists()) return;
      snap.forEach((child) => {
        pc.addIceCandidate(new RTCIceCandidate(child.val())).catch(() => {});
      });
    });
    this.cleanups.push(unsubCand);

    // 호스트의 ICE candidates 전송
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        push(ref(db, `${WEBRTC_PATH}/${sessionId}/hostCandidates`), candidate.toJSON());
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await set(ref(db, `${WEBRTC_PATH}/${sessionId}/offer`), {
      type: offer.type,
      sdp: offer.sdp,
    });
  }

  stop(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.pcs.forEach((pc) => pc.close());
    this.pcs.clear();
  }
}

// ─── Viewer ──────────────────────────────────────────────────────────────────

export class ViewerReceiver {
  readonly sessionId: string = crypto.randomUUID();
  private pc: RTCPeerConnection | null = null;
  private cleanups: Array<() => void> = [];

  /** Firebase에 등록 → 호스트 offer 대기 → 스트림 콜백 호출 */
  async connect(onStream: (stream: MediaStream) => void): Promise<void> {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pc = pc;

    pc.ontrack = (ev) => {
      if (ev.streams[0]) onStream(ev.streams[0]);
    };

    // 뷰어의 ICE candidates 전송 (await 전에 등록)
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        push(ref(db, `${WEBRTC_PATH}/${this.sessionId}/viewerCandidates`), candidate.toJSON());
      }
    };

    // 세션 등록
    await set(ref(db, `${WEBRTC_PATH}/${this.sessionId}`), { joined: true });
    if (this.pc !== pc) return; // await 사이에 disconnect 된 경우 중단

    // 호스트의 offer 수신
    const offerRef = ref(db, `${WEBRTC_PATH}/${this.sessionId}/offer`);
    const unsubOffer = onValue(offerRef, async (snap) => {
      if (!snap.exists() || this.pc !== pc) return;
      if (pc.signalingState !== "stable") return;

      await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await set(ref(db, `${WEBRTC_PATH}/${this.sessionId}/answer`), {
        type: answer.type,
        sdp: answer.sdp,
      });
    });
    this.cleanups.push(unsubOffer);

    // 호스트의 ICE candidates 수신
    const hostCandRef = ref(db, `${WEBRTC_PATH}/${this.sessionId}/hostCandidates`);
    const unsubCand = onValue(hostCandRef, (snap) => {
      if (!snap.exists() || this.pc !== pc) return;
      snap.forEach((child) => {
        pc.addIceCandidate(new RTCIceCandidate(child.val())).catch(() => {});
      });
    });
    this.cleanups.push(unsubCand);
  }

  disconnect(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    remove(ref(db, `${WEBRTC_PATH}/${this.sessionId}`)).catch(() => {});
    this.pc?.close();
    this.pc = null;
  }
}
