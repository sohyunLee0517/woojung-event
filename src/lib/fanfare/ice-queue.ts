// 상대 설명(remote description)이 정해지기 전에 온 ICE 후보를 모아 뒀다가 나중에 넣는다.
export class IceQueue {
  private pending: RTCIceCandidateInit[] = [];
  private seen = new Set<string>();
  private isReady = false;

  constructor(private apply: (c: RTCIceCandidateInit) => Promise<void>) {}

  private key(c: RTCIceCandidateInit) {
    return `${c.sdpMid ?? ""}|${c.sdpMLineIndex ?? ""}|${c.candidate ?? ""}`;
  }

  private async put(c: RTCIceCandidateInit) {
    try {
      await this.apply(c);
    } catch {
      // 잘못된 후보 하나 때문에 나머지를 멈추지 않는다
    }
  }

  async add(c: RTCIceCandidateInit) {
    const k = this.key(c);
    if (this.seen.has(k)) return;
    this.seen.add(k);
    if (this.isReady) await this.put(c);
    else this.pending.push(c);
  }

  async ready() {
    this.isReady = true;
    const list = this.pending;
    this.pending = [];
    for (const c of list) await this.put(c);
  }
}
