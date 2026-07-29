class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.currentMusic = null;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.6;

      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.musicGain.gain.value = 0.3;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = 0.7;

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicEnabled ? 0.3 : 0;
    }
    return this.musicEnabled;
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxEnabled ? 0.7 : 0;
    }
    return this.sfxEnabled;
  }

  playTone(frequency, duration, type = 'sine', gainValue = 0.3, delay = 0) {
    if (!this.initialized || !this.sfxEnabled) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(gainValue, this.ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(this.ctx.currentTime + delay);
    osc.stop(this.ctx.currentTime + delay + duration);
  }

  playNoise(duration, gainValue = 0.1, delay = 0) {
    if (!this.initialized || !this.sfxEnabled) return;
    this.resume();

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start(this.ctx.currentTime + delay);
  }

  // --- Sound Effects ---

  playCorrect() {
    if (!this.initialized) return;
    this.resume();

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.3, 'sine', 0.25, i * 0.12);
    });

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  playWrong() {
    if (!this.initialized) return;
    this.resume();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.8);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.8);
    osc2.stop(this.ctx.currentTime + 0.8);

    this.playNoise(0.5, 0.05);
  }

  playSelect() {
    this.playTone(800, 0.08, 'sine', 0.2);
    this.playTone(1000, 0.06, 'sine', 0.15, 0.05);
  }

  playLockIn() {
    if (!this.initialized) return;
    this.resume();

    const notes = [440, 554.37, 659.25];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.15, 'triangle', 0.2, i * 0.15);
    });
  }

  playLifeline() {
    if (!this.initialized) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.2);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);

    this.playTone(1200, 0.1, 'sine', 0.1, 0.3);
    this.playTone(1500, 0.1, 'sine', 0.1, 0.4);
  }

  playMilestone() {
    if (!this.initialized) return;
    this.resume();

    const fanfare = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    fanfare.forEach((freq, i) => {
      this.playTone(freq, 0.4, 'sine', 0.2, i * 0.1);
      this.playTone(freq * 0.5, 0.4, 'triangle', 0.1, i * 0.1);
    });
  }

  playGameOver() {
    if (!this.initialized) return;
    this.resume();

    const notes = [392, 349.23, 329.63, 261.63];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.5, 'sine', 0.2, i * 0.25);
      this.playTone(freq * 0.5, 0.5, 'triangle', 0.1, i * 0.25);
    });
  }

  playWin() {
    if (!this.initialized) return;
    this.resume();

    const melody = [
      [523.25, 0.15], [659.25, 0.15], [783.99, 0.15], [1046.50, 0.3],
      [783.99, 0.15], [1046.50, 0.15], [1318.51, 0.5],
      [1046.50, 0.15], [1318.51, 0.15], [1567.98, 0.6],
    ];

    let time = 0;
    melody.forEach(([freq, dur]) => {
      this.playTone(freq, dur, 'sine', 0.2, time);
      this.playTone(freq * 0.5, dur, 'triangle', 0.08, time);
      time += dur;
    });

    setTimeout(() => {
      [2093, 2637, 3136].forEach((freq, i) => {
        this.playTone(freq, 0.6, 'sine', 0.12, i * 0.15);
      });
    }, time * 1000);
  }

  playTick() {
    this.playTone(1000, 0.03, 'sine', 0.08);
  }

  playDramatic() {
    if (!this.initialized) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);

    this.playNoise(1.5, 0.03);
  }

  playMenuClick() {
    this.playTone(600, 0.05, 'sine', 0.15);
    this.playTone(800, 0.05, 'sine', 0.1, 0.04);
  }

  // --- Background Music ---

  startBackgroundMusic() {
    if (!this.initialized || !this.musicEnabled) return;
    this.resume();
    this.stopBackgroundMusic();

    this.currentMusic = this.createAmbientDrone();
  }

  createAmbientDrone() {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 110;
    osc2.type = 'sine';
    osc2.frequency.value = 165;
    osc3.type = 'triangle';
    osc3.frequency.value = 220;

    lfo.type = 'sine';
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = 5;

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    gain.gain.value = 0.12;

    osc1.connect(gain);
    osc2.connect(gain);
    osc3.connect(gain);
    gain.connect(this.musicGain);

    osc1.start();
    osc2.start();
    osc3.start();
    lfo.start();

    return { osc1, osc2, osc3, gain, lfo };
  }

  startTensionMusic() {
    if (!this.initialized || !this.musicEnabled) return;
    this.resume();
    this.stopBackgroundMusic();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;
    osc2.type = 'square';
    osc2.frequency.value = 82.5;
    osc3.type = 'sine';
    osc3.frequency.value = 110;

    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 5;

    gain.gain.value = 0.08;

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc1.start();
    osc2.start();
    osc3.start();

    const lfo = this.ctx.createOscillator();
    const lfoGainNode = this.ctx.createGain();
    lfo.frequency.value = 2;
    lfoGainNode.gain.value = 200;
    lfo.connect(lfoGainNode);
    lfoGainNode.connect(filter.frequency);
    lfo.start();

    this.currentMusic = { osc1, osc2, osc3, gain, lfo, filter };
  }

  startVictoryMusic() {
    if (!this.initialized || !this.musicEnabled) return;
    this.resume();
    this.stopBackgroundMusic();

    const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.50];
    let index = 0;

    const playNext = () => {
      if (!this.currentMusic || !this.musicEnabled) return;

      const freq = notes[index % notes.length];
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      noteGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

      osc.connect(noteGain);
      noteGain.connect(this.musicGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);

      const osc2 = this.ctx.createOscillator();
      const noteGain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 0.5;
      noteGain2.gain.setValueAtTime(0.06, this.ctx.currentTime);
      noteGain2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      osc2.connect(noteGain2);
      noteGain2.connect(this.musicGain);
      osc2.start();
      osc2.stop(this.ctx.currentTime + 0.5);

      index++;
      this._victoryTimeout = setTimeout(playNext, 350);
    };

    this.currentMusic = { stop: () => clearTimeout(this._victoryTimeout) };
    playNext();
  }

  stopBackgroundMusic() {
    if (this.currentMusic) {
      try {
        if (this.currentMusic.osc1) this.currentMusic.osc1.stop();
        if (this.currentMusic.osc2) this.currentMusic.osc2.stop();
        if (this.currentMusic.osc3) this.currentMusic.osc3.stop();
        if (this.currentMusic.lfo) this.currentMusic.lfo.stop();
        if (this.currentMusic.stop) this.currentMusic.stop();
      } catch (e) {}
      this.currentMusic = null;
    }
  }

  setMusicVolume(value) {
    if (this.musicGain) this.musicGain.gain.value = value;
  }

  setSfxVolume(value) {
    if (this.sfxGain) this.sfxGain.gain.value = value;
  }
}

window.audioManager = new AudioManager();
