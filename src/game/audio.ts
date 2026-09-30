export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
    }
  }

  private makeNoise(): AudioBuffer | null {
    if (!this.ctx) return null;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private env(duration: number, peak = 0.2): GainNode | null {
    if (!this.ctx || !this.sfx) return null;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    g.connect(this.sfx);
    return g;
  }

  private tone(freq: number, duration: number, type: OscillatorType, peak: number, detune = 0) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.env(duration, peak);
    if (!g) return;
    osc.type = type;
    osc.frequency.value = freq * (0.97 + Math.random() * 0.06);
    osc.detune.value = detune;
    osc.connect(g);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private burst(duration: number, peak: number, hp = 400) {
    if (!this.ctx || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = this.env(duration, peak);
    if (!g) return;
    src.connect(filter);
    filter.connect(g);
    src.start();
    src.stop(this.ctx.currentTime + duration);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  shoot() {
    this.tone(980, 0.055, "square", 0.07);
  }

  enemyShot() {
    this.tone(240, 0.08, "sawtooth", 0.05);
  }

  hit() {
    this.burst(0.08, 0.1, 900);
    this.tone(520, 0.06, "triangle", 0.05);
  }

  explode() {
    this.burst(0.28, 0.22, 180);
    this.tone(90, 0.22, "sine", 0.16);
  }

  pickup() {
    this.tone(660, 0.08, "square", 0.08);
    this.tone(990, 0.12, "square", 0.06, 0);
  }

  hurt() {
    this.burst(0.2, 0.18, 120);
    this.tone(70, 0.18, "sine", 0.2);
  }

  wave() {
    this.tone(440, 0.12, "triangle", 0.08);
    this.tone(660, 0.18, "triangle", 0.06);
  }

  boss() {
    this.tone(110, 0.4, "sine", 0.18);
    this.tone(165, 0.32, "sawtooth", 0.08);
    this.tone(55, 0.5, "sine", 0.14);
  }

  ui() {
    this.tone(520, 0.05, "sine", 0.05);
  }

  gameOver() {
    this.tone(220, 0.3, "sine", 0.12);
    this.tone(165, 0.45, "sine", 0.1);
  }
}
