const SFX_VOL_KEY = 'horario_de_pico_sfx_vol_v1';

class RetroAudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private sfxVolume = 0.85;
  private jumpBuffer: AudioBuffer | null = null;
  private jumpBufferLoading = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(SFX_VOL_KEY);
        if (raw !== null) {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) {
            this.sfxVolume = Math.max(0, Math.min(1, parsed));
          }
        }
      } catch {
        // Ignore storage errors
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || this.sfxVolume <= 0) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx) {
      if (!this.masterGain) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.sfxVolume;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (!this.jumpBuffer && !this.jumpBufferLoading) {
        this.preloadJumpBuffer(this.ctx);
      }
    }
    return this.ctx;
  }

  private preloadJumpBuffer(ctx: AudioContext) {
    if (this.jumpBufferLoading || typeof fetch === 'undefined') return;
    this.jumpBufferLoading = true;
    fetch('/assets/aistudio/liecio-twang-190022_5014ce03.mp3')
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('Audio fetch failed'))))
      .then((arr) => ctx.decodeAudioData(arr))
      .then((decoded) => {
        this.jumpBuffer = decoded;
      })
      .catch(() => {
        this.jumpBufferLoading = false;
      });
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.sfxVolume;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setSfxVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.sfxVolume = clamped;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : clamped;
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SFX_VOL_KEY, clamped.toFixed(2));
      } catch {
        // Ignore storage errors
      }
    }
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'square',
    gainVal = 0.12,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain ?? ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  private noise(duration: number, gainVal = 0.1, highpass = 600, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;

    const gain = ctx.createGain();
    const now = ctx.currentTime + delay;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain ?? ctx.destination);
    src.start(now);
  }

  private bandpassNoise(
    duration: number,
    gainVal = 0.12,
    centerFreq = 1800,
    q = 1.4,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centerFreq;
    filter.Q.value = q;

    const gain = ctx.createGain();
    const now = ctx.currentTime + delay;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain ?? ctx.destination);
    src.start(now);
  }

  public playPunch() {
    this.tone(240, 90, 0.08, 'square', 0.1);
    this.noise(0.05, 0.08, 900);
  }

  public playPunchSnap() {
    // Crisp leather/flesh punch snap ("estalo de soco")
    this.tone(215, 62, 0.068, 'triangle', 0.14);
    this.bandpassNoise(0.042, 0.16, 1950, 1.5);
  }

  public playUppercutCrack() {
    // Heavy uppercut finisher crack + rising whoosh
    this.tone(165, 44, 0.14, 'sawtooth', 0.15);
    this.bandpassNoise(0.07, 0.18, 1550, 1.2);
    this.tone(280, 480, 0.08, 'triangle', 0.07, 0.02);
  }

  public playHeavyPunchImpact() {
    // Deep sub-bass chest thud + crisp punch-glove transient without excessive gain
    this.tone(125, 40, 0.15, 'sine', 0.16);
    this.tone(205, 56, 0.095, 'triangle', 0.12);
    this.bandpassNoise(0.032, 0.15, 2100, 1.6);
    this.bandpassNoise(0.018, 0.11, 3400, 1.8);
  }

  public playKickImpact(aerial = false) {
    // Solid martial kick impact (plus golden harmonic snap for Crane / Special kick)
    this.tone(aerial ? 250 : 210, 52, aerial ? 0.14 : 0.11, 'sawtooth', 0.15);
    this.bandpassNoise(aerial ? 0.085 : 0.06, 0.17, aerial ? 2350 : 1650, 1.3);
    if (aerial) {
      this.tone(587.33, 880, 0.09, 'triangle', 0.08, 0.015);
    }
  }

  public playKickFinisherImpact() {
    // Weighty roundhouse bass impact + sharp snap transient
    this.tone(135, 40, 0.16, 'sine', 0.16);
    this.tone(228, 52, 0.11, 'sawtooth', 0.11);
    this.bandpassNoise(0.038, 0.15, 2400, 1.5);
    this.bandpassNoise(0.02, 0.11, 3600, 1.9);
  }

  public playMetallicImpact(heavy = false) {
    // Unmistakable metallic clang for armor, turnstile boss, handrail, and guard breaks
    const gainScale = heavy ? 1.25 : 1;
    this.tone(175, 65, heavy ? 0.14 : 0.09, 'sawtooth', 0.11 * gainScale);
    this.tone(940, 890, heavy ? 0.2 : 0.13, 'triangle', 0.11 * gainScale);
    this.tone(1420, 1340, heavy ? 0.22 : 0.14, 'square', 0.065 * gainScale, 0.006);
    this.tone(2180, 1960, heavy ? 0.18 : 0.11, 'sine', 0.07 * gainScale, 0.01);
    this.bandpassNoise(0.055, 0.14 * gainScale, 3200, 2.2);
  }

  public playCaneCrack() {
    // Crisp wooden cane impact snap
    this.tone(560, 190, 0.09, 'triangle', 0.16);
    this.bandpassNoise(0.05, 0.16, 2550, 2.0);
  }

  public playBagThump() {
    // Heavy padded backpack impact thud
    this.tone(145, 48, 0.12, 'triangle', 0.17);
    this.bandpassNoise(0.07, 0.13, 850, 1.0);
  }

  public playWhipImpact() {
    // Headphone cable whip snap
    this.bandpassNoise(0.055, 0.18, 3100, 1.8);
    this.tone(720, 240, 0.08, 'sawtooth', 0.11);
  }

  public playHeavyHit() {
    this.tone(180, 55, 0.14, 'sawtooth', 0.14);
    this.noise(0.09, 0.13, 350);
  }

  public playCaneHit() {
    this.tone(420, 120, 0.11, 'triangle', 0.15);
    this.noise(0.06, 0.1, 1200);
  }

  public playKick() {
    this.tone(290, 75, 0.11, 'sawtooth', 0.12);
    this.noise(0.07, 0.09, 700);
  }

  public playJump() {
    if (this.muted || this.sfxVolume <= 0) return;
    const ctx = this.ensureContext();
    if (ctx && this.jumpBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.jumpBuffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.48;
      src.connect(gain);
      gain.connect(this.masterGain ?? ctx.destination);
      src.start(0);
      return;
    }
    if (typeof Audio !== 'undefined') {
      const el = new Audio('/assets/aistudio/liecio-twang-190022_5014ce03.mp3');
      el.volume = 0.48 * this.sfxVolume;
      el.play().catch(() => {});
    }
  }

  public playSpecial() {
    this.tone(180, 620, 0.18, 'sawtooth', 0.13);
    this.noise(0.18, 0.12, 800);
  }

  public playRockWhip() {
    // Rock power-chord riff (E5 + B5 + octave E6) with distorted sawtooth/square + whip crack snap
    this.noise(0.08, 0.15, 1900, 0);
    this.tone(920, 210, 0.11, 'sawtooth', 0.11, 0);
    this.tone(164.81, 164.81, 0.24, 'sawtooth', 0.13, 0.02);
    this.tone(246.94, 246.94, 0.24, 'square', 0.09, 0.02);
    this.tone(329.63, 329.63, 0.28, 'sawtooth', 0.1, 0.04);
    this.tone(392.0, 440.0, 0.18, 'square', 0.08, 0.16);
  }

  public playHurt() {
    this.tone(170, 70, 0.15, 'sawtooth', 0.14);
  }

  public playBlock() {
    this.tone(520, 320, 0.08, 'square', 0.11);
    this.tone(360, 260, 0.08, 'triangle', 0.09, 0.03);
  }

  public playGumSplat() {
    this.tone(160, 280, 0.09, 'triangle', 0.09);
  }

  public playPickup() {
    this.tone(520, 780, 0.08, 'square', 0.09);
    this.tone(780, 1040, 0.1, 'square', 0.09, 0.06);
  }

  public playHeal() {
    this.tone(440, 554, 0.09, 'triangle', 0.11);
    this.tone(554, 659, 0.09, 'triangle', 0.11, 0.07);
    this.tone(659, 880, 0.14, 'triangle', 0.12, 0.14);
  }

  public playMakeup() {
    this.tone(587, 880, 0.09, 'sine', 0.1);
    this.tone(880, 1175, 0.14, 'sine', 0.1, 0.08);
  }

  public playSpray() {
    this.noise(0.24, 0.14, 1800);
    this.tone(900, 1300, 0.16, 'sine', 0.05);
  }

  public playValidate() {
    this.tone(988, 988, 0.07, 'square', 0.11);
    this.tone(1318, 1318, 0.14, 'square', 0.11, 0.09);
  }

  public playWhistle() {
    this.tone(2100, 2450, 0.09, 'sine', 0.11);
    this.tone(2400, 2050, 0.09, 'sine', 0.11, 0.09);
    this.tone(2150, 2500, 0.12, 'sine', 0.11, 0.18);
  }

  public playTurnstileSpin() {
    this.tone(220, 440, 0.12, 'sawtooth', 0.09);
    this.tone(440, 220, 0.12, 'sawtooth', 0.09, 0.12);
  }

  public playMotoristaHornAnticipate() {
    // Crisp pre-horn click/mini-chirp signaling horn press before sonic blast
    this.tone(420, 520, 0.045, 'square', 0.055);
  }

  public playMotoristaTurboSpin() {
    // Bus engine turbo rev + steering-wheel cyclone whoosh
    this.tone(125, 340, 0.22, 'sawtooth', 0.095);
    this.bandpassNoise(0.18, 0.095, 980, 1.3, 0.02);
  }

  public playMotoristaAccelerate() {
    // Bus diesel rev + tire launch burst for Acelerada dash
    this.tone(95, 290, 0.19, 'sawtooth', 0.115);
    this.bandpassNoise(0.12, 0.105, 1300, 1.2, 0.01);
  }

  public playMotoristaStomp() {
    // Heavy bus-floor brake stomp thump for Freada Brusca shockwave
    this.tone(118, 38, 0.24, 'sine', 0.155);
    this.tone(168, 52, 0.16, 'triangle', 0.12);
    this.bandpassNoise(0.085, 0.11, 520, 1.1);
  }

  public playBossAlert() {
    this.tone(220, 180, 0.14, 'sawtooth', 0.13);
    this.tone(220, 180, 0.14, 'sawtooth', 0.13, 0.18);
    this.tone(330, 150, 0.25, 'sawtooth', 0.15, 0.36);
  }

  public playBossFinisher() {
    // Deep arcade KO boom + triple impact + triumphant finisher chime
    this.tone(175, 42, 0.42, 'sawtooth', 0.18, 0);
    this.noise(0.28, 0.18, 320, 0);
    this.noise(0.14, 0.14, 900, 0.12);
    this.tone(523.25, 523.25, 0.1, 'square', 0.1, 0.22);
    this.tone(659.25, 659.25, 0.1, 'square', 0.1, 0.31);
    this.tone(783.99, 1046.5, 0.24, 'triangle', 0.13, 0.4);
  }

  public playGrappleGrab() {
    this.tone(140, 82, 0.085, 'triangle', 0.15, 0);
    this.bandpassNoise(0.05, 0.14, 1100, 1.4, 0.01);
  }

  public playGiantSwingWhoosh() {
    this.tone(240, 480, 0.14, 'sine', 0.08, 0);
    this.bandpassNoise(0.15, 0.13, 720, 1.1, 0.01);
  }

  public playFinisherSlam() {
    this.tone(155, 36, 0.28, 'sawtooth', 0.18, 0);
    this.tone(95, 32, 0.24, 'triangle', 0.17, 0.01);
    this.noise(0.18, 0.17, 360, 0);
    this.bandpassNoise(0.09, 0.14, 1600, 1.3, 0.02);
  }

  public playStopBell() {
    this.tone(1174, 1174, 0.14, 'triangle', 0.16);
    this.tone(1568, 1568, 0.22, 'triangle', 0.16, 0.12);
  }

  public playCorporateNotification() {
    // Crisp Teams-inspired 3-note corporate ping
    this.tone(784, 784, 0.08, 'sine', 0.15, 0);
    this.tone(1046.5, 1046.5, 0.09, 'sine', 0.16, 0.085);
    this.tone(1318.5, 1318.5, 0.19, 'triangle', 0.15, 0.175);
  }

  public playBusBrake() {
    // Air-brake hiss + tire screech
    this.noise(0.32, 0.14, 1400, 0);
    this.tone(620, 290, 0.26, 'sawtooth', 0.09, 0.02);
  }

  public playBusBump() {
    // Suspension thud for speed bump (Lombada)
    this.tone(145, 52, 0.18, 'triangle', 0.18, 0);
    this.noise(0.11, 0.11, 280, 0.02);
  }

  public playRailGrab() {
    // Metallic grab clink on overhead yellow rail
    this.tone(680, 920, 0.07, 'triangle', 0.11, 0);
  }

  public playBagGuard() {
    // Quick backpack shield brace + parry ping
    this.tone(420, 640, 0.07, 'triangle', 0.12, 0);
    this.noise(0.05, 0.07, 1100, 0);
  }

  public playBagSpin() {
    // 360 backpack counter-spin swoosh + heavy thump
    this.tone(360, 140, 0.15, 'sawtooth', 0.13, 0);
    this.noise(0.14, 0.12, 650, 0.01);
  }

  public playBusCurve() {
    // Sharp cornering tire squeal + lean swoosh
    this.tone(520, 740, 0.14, 'sawtooth', 0.08, 0);
    this.tone(740, 460, 0.16, 'triangle', 0.08, 0.12);
  }

  public playExpressWind() {
    // Express corridor wind gust
    this.noise(0.38, 0.12, 950, 0);
    this.tone(240, 480, 0.28, 'sine', 0.08, 0.02);
  }

  public playSoundWave() {
    // Punchy bass drop + crisp sonic pulse ring for Sound Special & Tiozão speaker
    this.tone(110, 48, 0.28, 'sawtooth', 0.16, 0);
    this.tone(480, 960, 0.16, 'triangle', 0.11, 0.03);
    this.noise(0.18, 0.11, 1400, 0);
  }

  public playSkateDash() {
    // Rolling wheel rattle + fast dash zip
    this.noise(0.16, 0.1, 1100, 0);
    this.tone(320, 620, 0.14, 'square', 0.08, 0);
  }

  public playVictory(lineNumber: 1 | 2 | 3 = 3) {
    if (this.muted) return;
    // Celebratory SFX layer: arcade confetti burst / shimmer + triumph chime
    this.noise(0.14 + lineNumber * 0.06, 0.06 + lineNumber * 0.025, 1600, 0);
    this.tone(440, 880, 0.14, 'triangle', 0.08 + lineNumber * 0.02, 0);

    if (lineNumber === 1) {
      // Line 1: crisp upbeat 4-note celebratory sting
      const lead = [523.25, 659.25, 783.99, 1046.5];
      lead.forEach((n, idx) => {
        this.tone(n, n * 1.01, 0.16, 'square', 0.095, 0.04 + idx * 0.11);
      });
      this.tone(261.63, 261.63, 0.28, 'triangle', 0.1, 0.37);
      return;
    }

    if (lineNumber === 2) {
      // Line 2: richer dual-voice arcade sting + celebratory bell
      const lead = [523.25, 659.25, 783.99, 987.77, 1046.5];
      const bass = [261.63, 329.63, 392.0, 493.88, 523.25];
      lead.forEach((n, idx) => {
        const t = 0.03 + idx * 0.105;
        const dur = idx === lead.length - 1 ? 0.34 : 0.14;
        this.tone(n, n * 1.01, dur, 'square', 0.105, t);
        this.tone(bass[idx], bass[idx], dur, 'triangle', 0.1, t);
      });
      this.noise(0.16, 0.09, 2200, 0.45);
      return;
    }

    // Line 3: Grand championship finale sting — multi-voice fanfare + snare roll + full triad chord
    this.noise(0.05, 0.09, 1100, 0.0);
    this.noise(0.05, 0.1, 1200, 0.09);
    this.noise(0.07, 0.12, 1350, 0.18);
    this.noise(0.28, 0.14, 2400, 0.62);

    const melody = [
      { f: 392.0, t: 0.02, d: 0.1 }, // G4
      { f: 523.25, t: 0.11, d: 0.1 }, // C5
      { f: 659.25, t: 0.2, d: 0.1 }, // E5
      { f: 783.99, t: 0.29, d: 0.14 }, // G5
      { f: 659.25, t: 0.42, d: 0.1 }, // E5
      { f: 783.99, t: 0.51, d: 0.11 }, // G5
      { f: 1046.5, t: 0.62, d: 0.48 }, // C6!
    ];
    melody.forEach((note) => {
      this.tone(note.f, note.f * 1.008, note.d, 'square', 0.115, note.t);
      this.tone(note.f * 0.5, note.f * 0.5, note.d, 'triangle', 0.11, note.t);
    });

    // Final triumphant C-major harmonic chord stack + high arcade chime
    [523.25, 659.25, 783.99, 1318.51].forEach((freq) => {
      this.tone(freq, freq, 0.46, 'sawtooth', 0.055, 0.62);
    });
    this.tone(1567.98, 2093.0, 0.3, 'sine', 0.08, 0.72);
  }

  public playGameOver() {
    const notes = [392, 349, 311, 261];
    notes.forEach((n, idx) => {
      this.tone(n, n * 0.96, 0.22, 'sawtooth', 0.11, idx * 0.18);
    });
  }
}

export const audio = new RetroAudioSynth();
