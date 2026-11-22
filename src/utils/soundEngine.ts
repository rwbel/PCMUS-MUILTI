/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * soundEngine.ts - Motor de sonido procedural (Web Audio API)
 *
 * Genera todo el audio del juego sin archivos externos:
 *   - Música jazz lo-fi ambiental (progresión de acordes en C menor / Eb mayor)
 *   - Ruido de vinilo y lluvia (efecto de fondo)
 *   - Efectos de sonido (SFX): cartas, piedras, victorias, tragos, etc.
 *
 * Todo se genera sintéticamente con osciladores y filtros del navegador.
 * No depende de archivos MP3/WAV externos.
 */

class LoFiSoundEngine {
  private ctx: AudioContext | null = null;
  private isMusicPlaying: boolean = false;
  private musicVolume: number = 0.35;
  private sfxVolume: number = 0.6;
  private isMuted: boolean = false;
  private timerId: number | null = null;
  private vinylNode: AudioNode | null = null;
  private currentChordIndex: number = 0;

  // Progression: Classic cozy Lo-Fi Jazz in C minor / Eb major
  // [Cm9, F13, Bbmaj9, Ebmaj7, Abmaj7, Dm7b5, G7b9, Cm9]
  private readonly chords: number[][] = [
    [130.81, 196.00, 233.08, 293.66, 349.23], // Cm9 (C3, G3, Bb3, D4, F4)
    [174.61, 220.00, 261.63, 329.63, 440.00], // F13 (F3, A3, C4, E4, A4)
    [116.54, 174.61, 233.08, 293.66, 392.00], // Bbmaj9 (Bb2, F3, Bb3, D4, G4)
    [155.56, 196.00, 246.94, 293.66, 349.23], // Ebmaj7 (Eb3, G3, B3, D4, F4)
    [103.83, 164.81, 207.65, 261.63, 329.63], // Abmaj7 (Ab2, E3, Ab3, C4, E4)
    [146.83, 220.00, 261.63, 311.13, 392.00], // Dm7b5 (D3, A3, C4, Eb4, G4)
    [98.00, 146.83, 207.65, 246.94, 311.13],  // G7b9 (G2, D3, Ab3, B3, Eb4)
    [130.81, 196.00, 246.94, 293.66, 392.00], // CmM9 (C3, G3, B3, D4, G4)
  ];

  private readonly bassNotes: number[] = [
    65.41,  // C2
    87.31,  // F2
    58.27,  // Bb1
    77.78,  // Eb2
    51.91,  // Ab1
    73.42,  // D2
    49.00,  // G1
    65.41,  // C2
  ];

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public startMusic() {
    this.initContext();
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.startVinylNoise();
    this.playLoopStep();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.timerId) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.vinylNode) {
      try {
        this.vinylNode.disconnect();
      } catch {}
      this.vinylNode = null;
    }
  }

  public toggleMusic(): boolean {
    if (this.isMusicPlaying) {
      this.stopMusic();
      return false;
    } else {
      this.startMusic();
      return true;
    }
  }

  public getIsPlaying(): boolean {
    return this.isMusicPlaying;
  }

  public setVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.musicVolume;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public isMute(): boolean {
    return this.isMuted;
  }

  private startVinylNoise() {
    if (!this.ctx || this.isMuted) return;
    try {
      // 2 seconds buffer of softly filtered noise (rain & vinyl crackle)
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise filter for rain effect
        lastOut = (lastOut + 0.02 * white) / 1.02;
        // occasional crackle
        const crackle = Math.random() > 0.998 ? (Math.random() * 0.4 - 0.2) : 0;
        output[i] = lastOut * 0.15 + crackle;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 850;

      const gain = this.ctx.createGain();
      gain.gain.value = this.musicVolume * 0.12;

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
      this.vinylNode = gain;
    } catch {}
  }

  private playLoopStep = () => {
    if (!this.isMusicPlaying || !this.ctx) return;
    if (!this.isMuted) {
      this.playChord(this.currentChordIndex);
      this.playWalkingBass(this.currentChordIndex);
      this.playBrushSnare();
    }

    this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
    // Each chord bar lasts ~2.6 seconds (relaxed 68 BPM feel)
    this.timerId = window.setTimeout(this.playLoopStep, 2600);
  };

  private playChord(index: number) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const chord = this.chords[index];

    chord.forEach((freq, noteIdx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Fender Rhodes style: sine wave with subtle triangle overtone
      osc.type = noteIdx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 0.6, now);

      // Low pass filter for warm lo-fi tone
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700 + noteIdx * 150, now);

      // Gentle strum delay between chord notes (humanized)
      const noteDelay = noteIdx * 0.035;
      const startTime = now + noteDelay;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(this.musicVolume * 0.08, startTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 2.4);
    });
  }

  private playWalkingBass(index: number) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const freq = this.bassNotes[index];

    // Primary bass note
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.musicVolume * 0.16, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.9);

    // Subtle ghost step note in second half of bar
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 1.5, now + 1.3); // Fifth above
    gain2.gain.setValueAtTime(0, now + 1.3);
    gain2.gain.linearRampToValueAtTime(this.musicVolume * 0.09, now + 1.35);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 2.3);

    osc2.connect(filter);
    filter.connect(gain2);
    gain2.connect(this.ctx.destination);

    osc2.start(now + 1.3);
    osc2.stop(now + 2.4);
  }

  private playBrushSnare() {
    if (!this.ctx || this.isMuted) return;
    // Soft jazz brush on beat 2 & 4
    [0.65, 1.95].forEach(offset => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + offset;
      const bufferSize = this.ctx.sampleRate * 0.15;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(2400, now);
      bandpass.Q.setValueAtTime(1.2, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.musicVolume * 0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.15);
    });
  }

  // --- SOUND EFFECTS ---

  public playCardDeal() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Quick swoosh
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.sfxVolume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  public playStoneClink() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Ceramic / metallic stone clink sound
    [1800, 2450].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + i * 80, now);

      gain.gain.setValueAtTime(this.sfxVolume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    });
  }

  public playEnvidoChord() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.02);

      gain.gain.setValueAtTime(this.sfxVolume * 0.18, now + idx * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.02);
      osc.stop(now + 0.65);
    });
  }

  public playOrdagoDrama() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Deep dramatic impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.8);

    gain.gain.setValueAtTime(this.sfxVolume * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.3);

    // High suspense bell
    const bell = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(880, now);
    bellGain.gain.setValueAtTime(this.sfxVolume * 0.25, now);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

    bell.connect(bellGain);
    bellGain.connect(this.ctx.destination);
    bell.start(now);
    bell.stop(now + 1.6);
  }

  public playPop() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.05);

    gain.gain.setValueAtTime(this.sfxVolume * 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playWin() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const fanfare = [392.00, 440.00, 523.25, 659.25, 783.99]; // G4, A4, C5, E5, G5
    fanfare.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(this.sfxVolume * 0.2, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.7);
    });
  }

  public playDrinkServe() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // High crystalline glass clink
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, now);
    osc.frequency.exponentialRampToValueAtTime(1980, now + 0.04);
    gain.gain.setValueAtTime(this.sfxVolume * 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);

    // Second resonant glass overtone
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1320, now + 0.05);
    gain2.gain.setValueAtTime(this.sfxVolume * 0.18, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.45);
  }
}

export const soundEngine = new LoFiSoundEngine();
