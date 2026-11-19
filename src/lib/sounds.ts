let _ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext();
  }
  return _ctx;
}

export async function resumeAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();
}

/** 빵빠레: C5 E5 G5 C6 상승 팡파레 + 화음 */
export function playFanfare(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // 상승 멜로디
  const melody: [number, number][] = [
    [523.25, 0],     // C5
    [659.25, 0.15],  // E5
    [783.99, 0.30],  // G5
    [1046.50, 0.45], // C6
  ];
  melody.forEach(([freq, delay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.12, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.35);
  });

  // 마무리 화음 C5-G5-C6
  [523.25, 783.99, 1046.50].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + 0.65);
    gain.gain.setValueAtTime(0, now + 0.65);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.70);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.65);
    osc.stop(now + 2.0);
  });
}

/** 넷플릭스 "두둥(Tudum)" 효과음 */
export function playTudum(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // 1) 베이스 드럼 어택 (화이트 노이즈 버스트)
  const bufSize = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(1.0, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  // 2) 킥 저음
  const kick = ctx.createOscillator();
  const kickGain = ctx.createGain();
  kick.type = "sine";
  kick.frequency.setValueAtTime(120, now);
  kick.frequency.exponentialRampToValueAtTime(40, now + 0.18);
  kickGain.gain.setValueAtTime(0, now);
  kickGain.gain.linearRampToValueAtTime(0.9, now + 0.01);
  kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  kick.connect(kickGain);
  kickGain.connect(ctx.destination);
  kick.start(now);
  kick.stop(now + 0.22);

  // 3) 공명 "dum" 음 (G2, 약간 떨림)
  const dum = ctx.createOscillator();
  const dumGain = ctx.createGain();
  dum.type = "sine";
  dum.frequency.setValueAtTime(98, now + 0.06);  // G2
  dum.frequency.linearRampToValueAtTime(85, now + 0.4);
  dumGain.gain.setValueAtTime(0, now + 0.06);
  dumGain.gain.linearRampToValueAtTime(0.75, now + 0.12);
  dumGain.gain.setValueAtTime(0.75, now + 0.35);
  dumGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  dum.connect(dumGain);
  dumGain.connect(ctx.destination);
  dum.start(now + 0.06);
  dum.stop(now + 1.8);

  // 4) 바이브라토
  const vib = ctx.createOscillator();
  const vibGain = ctx.createGain();
  vib.frequency.setValueAtTime(4.5, now + 0.35);
  vibGain.gain.setValueAtTime(2.5, now + 0.35);
  vib.connect(vibGain);
  vibGain.connect(dum.frequency);
  vib.start(now + 0.35);
  vib.stop(now + 1.8);
}

/** 카운트다운 삑 (go: 시작! 은 높고 길게) */
export function playBeep(go = false): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(go ? 1046.5 : 523.25, now);
  const len = go ? 0.5 : 0.18;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + len);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + len);
}
