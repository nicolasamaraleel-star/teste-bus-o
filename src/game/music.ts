// Per-line background music controller:
// Requests Lyria 3 generated music from /api/music/line and falls back automatically
// to a multi-track procedural Web Audio arcade groove tailored for each bus line.

interface LineGrooveSpec {
  bpm: number;
  bassNotes: number[];
  leadNotes: number[];
  leadWave: OscillatorType;
}

const LINE_GROOVES: Record<1 | 2 | 3, LineGrooveSpec> = {
  1: {
    bpm: 132,
    bassNotes: [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83],
    leadNotes: [440, 0, 523.25, 587.33, 659.25, 0, 587.33, 523.25, 440, 0, 392, 440, 523.25, 659.25, 587.33, 0],
    leadWave: 'square',
  },
  2: {
    bpm: 142,
    bassNotes: [98, 98, 116.54, 130.81, 98, 146.83, 130.81, 116.54],
    leadNotes: [392, 466.16, 0, 523.25, 587.33, 523.25, 466.16, 0, 392, 0, 466.16, 587.33, 698.46, 0, 587.33, 523.25],
    leadWave: 'sawtooth',
  },
  3: {
    bpm: 152,
    bassNotes: [130.81, 130.81, 155.56, 174.61, 196, 174.61, 155.56, 146.83],
    leadNotes: [523.25, 622.25, 698.46, 0, 783.99, 698.46, 622.25, 523.25, 587.33, 0, 698.46, 783.99, 932.33, 783.99, 698.46, 0],
    leadWave: 'sawtooth',
  },
};

const MUSIC_VOL_KEY = 'horario_de_pico_music_vol_v1';

class LineMusicManager {
  private muted = false;
  private musicVolume = 0.75;
  private activeLine: 1 | 2 | 3 | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private trackCache = new Map<number, string | null>();
  private inFlight = new Map<number, Promise<string | null>>();

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private connectedEls = new WeakSet<HTMLAudioElement>();
  private seqTimer: number | null = null;
  private stepIdx = 0;
  private playingProcedural = false;
  private paused = false;
  private beatOriginMs = 0;
  private lastKickMs = 0;
  private lastBeatWeight = 1;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(MUSIC_VOL_KEY);
        if (raw !== null) {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) {
            this.musicVolume = Math.max(0, Math.min(1, parsed));
          }
        }
      } catch {
        // Ignore storage errors
      }
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setMusicVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.musicVolume = clamped;
    if (this.masterGain) {
      this.masterGain.gain.value = clamped;
    }
    if (this.audioEl) {
      this.audioEl.volume = 0.42 * clamped;
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MUSIC_VOL_KEY, clamped.toFixed(2));
      } catch {
        // Ignore storage errors
      }
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.audioEl) {
      this.audioEl.muted = muted;
      if (!muted && this.audioEl.paused && this.activeLine !== null) {
        this.audioEl.play().catch(() => {});
      }
    }
    if (muted) {
      this.stopProcedural();
    } else if (this.activeLine !== null && !this.paused && !this.hasActiveLyriaAudio()) {
      this.startProcedural(this.activeLine);
    }
  }

  private hasActiveLyriaAudio(): boolean {
    return Boolean(this.audioEl && this.audioEl.src && !this.audioEl.paused);
  }

  public stop() {
    this.activeLine = null;
    this.paused = false;
    this.stopLyriaAudio();
    this.stopProcedural();
  }

  public pause() {
    this.paused = true;
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
    }
    this.stopProcedural();
  }

  public getBeatPulse(): { energy: number; bpm: number; active: boolean } {
    if (this.activeLine === null || this.paused) {
      return { energy: 0, bpm: 132, active: false };
    }

    const bpm = LINE_GROOVES[this.activeLine].bpm;
    const now = performance.now();
    const beatMs = 60000 / bpm;
    const refMs =
      this.playingProcedural && this.lastKickMs > 0 && now - this.lastKickMs < beatMs * 1.6
        ? this.lastKickMs
        : this.beatOriginMs;
    const elapsed = Math.max(0, now - refMs);
    const phase = (elapsed % beatMs) / beatMs;
    const beatDecay = Math.exp(-phase * 5.0) * (this.playingProcedural ? this.lastBeatWeight : 1);

    let audioEnergy = 0;
    if (this.analyser && this.freqData && !this.muted) {
      this.analyser.getByteFrequencyData(this.freqData);
      const bins = Math.min(8, this.freqData.length);
      let sum = 0;
      for (let i = 0; i < bins; i++) {
        sum += this.freqData[i];
      }
      audioEnergy = Math.min(1, sum / (bins * 160));
    }

    const raw = this.muted ? beatDecay * 0.45 : Math.max(beatDecay * 0.85, audioEnergy);
    return {
      energy: Math.max(0, Math.min(1, raw)),
      bpm,
      active: true,
    };
  }

  public async playLineMusic(lineNumber: 1 | 2 | 3) {
    this.paused = false;
    if (this.activeLine === lineNumber && (this.hasActiveLyriaAudio() || this.playingProcedural)) {
      return;
    }

    this.activeLine = lineNumber;
    this.beatOriginMs = performance.now();
    this.lastKickMs = this.beatOriginMs;
    this.stopLyriaAudio();
    this.stopProcedural();

    // Start procedural arcade groove immediately while Lyria clip loads or if unavailable
    if (!this.muted) {
      this.startProcedural(lineNumber);
    }

    const trackUrl = await this.fetchLineTrack(lineNumber);
    if (this.activeLine !== lineNumber || this.paused || !trackUrl) {
      return;
    }

    // Switch seamlessly to Lyria audio track when available
    this.stopProcedural();
    const el = new Audio(trackUrl);
    el.loop = true;
    el.volume = 0.42 * this.musicVolume;
    el.muted = this.muted;
    this.audioEl = el;
    this.connectElementToAnalyser(el);
    el.play().catch(() => {
      // Autoplay blocked or decoding issue -> keep procedural groove alive
      if (!this.muted && this.activeLine === lineNumber && !this.paused) {
        this.startProcedural(lineNumber);
      }
    });
  }

  private connectElementToAnalyser(el: HTMLAudioElement) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.analyser || this.connectedEls.has(el)) return;
    try {
      const source = ctx.createMediaElementSource(el);
      source.connect(this.analyser);
      this.connectedEls.add(el);
    } catch {
      // Fallback gracefully to BPM-phase pulse if media source cannot attach
    }
  }

  private async fetchLineTrack(lineNumber: 1 | 2 | 3): Promise<string | null> {
    if (this.trackCache.has(lineNumber)) {
      return this.trackCache.get(lineNumber) ?? null;
    }
    const existing = this.inFlight.get(lineNumber);
    if (existing) return existing;

    const req = (async () => {
      try {
        const res = await fetch('/api/music/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineNumber }),
        });
        if (!res.ok) {
          this.trackCache.set(lineNumber, null);
          return null;
        }
        const data = (await res.json()) as {
          available?: boolean;
          audioDataUrl?: string;
        };
        if (data.available && data.audioDataUrl) {
          this.trackCache.set(lineNumber, data.audioDataUrl);
          return data.audioDataUrl;
        }
        this.trackCache.set(lineNumber, null);
        return null;
      } catch {
        this.trackCache.set(lineNumber, null);
        return null;
      } finally {
        this.inFlight.delete(lineNumber);
      }
    })();

    this.inFlight.set(lineNumber, req);
    return req;
  }

  private stopLyriaAudio() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
  }

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx) {
      if (!this.analyser) {
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.72;
        this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
        this.analyser.connect(this.ctx.destination);
      }
      if (!this.masterGain) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.musicVolume;
        this.masterGain.connect(this.analyser);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
    return this.ctx;
  }

  private startProcedural(lineNumber: 1 | 2 | 3) {
    if (this.muted || this.playingProcedural || this.paused) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    this.playingProcedural = true;
    const outputNode = this.masterGain ?? ctx.destination;
    const spec = LINE_GROOVES[lineNumber];
    const stepMs = (60 / spec.bpm / 2) * 1000; // eighth-note pulse

    const tickStep = () => {
      if (!this.playingProcedural || this.muted || this.paused || this.activeLine !== lineNumber) {
        return;
      }
      const now = ctx.currentTime;

      if (this.stepIdx % 2 === 0) {
        this.lastKickMs = performance.now();
        this.lastBeatWeight = this.stepIdx % 4 === 0 ? 1 : 0.72;
      }

      const bassFreq = spec.bassNotes[this.stepIdx % spec.bassNotes.length];
      if (bassFreq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassFreq, now);
        gain.gain.setValueAtTime(0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(outputNode);
        osc.start(now);
        osc.stop(now + 0.17);
      }

      const leadFreq = spec.leadNotes[this.stepIdx % spec.leadNotes.length];
      if (leadFreq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = spec.leadWave;
        osc.frequency.setValueAtTime(leadFreq, now);
        gain.gain.setValueAtTime(0.024, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(outputNode);
        osc.start(now);
        osc.stop(now + 0.15);
      }

      // Crisp kick on beat 0 & 4, snare/hat on off-beats
      if (this.stepIdx % 4 === 0) {
        const kick = ctx.createOscillator();
        const kGain = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(125, now);
        kick.frequency.exponentialRampToValueAtTime(42, now + 0.09);
        kGain.gain.setValueAtTime(0.08, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        kick.connect(kGain);
        kGain.connect(outputNode);
        kick.start(now);
        kick.stop(now + 0.11);
      } else if (this.stepIdx % 4 === 2) {
        const hat = ctx.createOscillator();
        const hGain = ctx.createGain();
        hat.type = 'square';
        hat.frequency.setValueAtTime(640, now);
        hat.frequency.exponentialRampToValueAtTime(220, now + 0.04);
        hGain.gain.setValueAtTime(0.02, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        hat.connect(hGain);
        hGain.connect(outputNode);
        hat.start(now);
        hat.stop(now + 0.05);
      }

      this.stepIdx = (this.stepIdx + 1) % 32;
    };

    tickStep();
    this.seqTimer = window.setInterval(tickStep, stepMs);
  }

  private stopProcedural() {
    this.playingProcedural = false;
    if (this.seqTimer !== null) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
  }
}

export const musicManager = new LineMusicManager();
