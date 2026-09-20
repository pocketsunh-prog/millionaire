#!/usr/bin/env node
/**
 * Procedural audio asset generator for the native Millionaire Android app.
 *
 * Synthesises the background music loops and sound effects that ship in
 * app/src/main/res/raw as 16-bit PCM mono WAV files (22050 Hz).
 *
 * Everything is generated from scratch with plain JavaScript math — no external
 * samples, libraries or encoders — so the sounds are original and the assets can
 * be regenerated at any time:
 *
 *   node tools/generate-audio.js
 *
 * Design notes:
 * - Voices are additive or Karplus-Strong based, so nothing aliases: every
 *   partial above Nyquist is skipped instead of folding back.
 * - BGM loops are composed to an exact number of bars and then seam-crossfaded
 *   so the last sample flows into the first without a click.
 *
 * The Kotlin playback side lives in
 * app/src/main/java/com/millionaire/game/audio/SoundManager.kt. Together they
 * ship the same sound design as the React Native client (see
 * ../../millionaire-rn/tools/generate-audio.js) so both apps sound alike.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SR = 22050;
const TAU = Math.PI * 2;
const OUT_DIR = path.join(__dirname, '..', 'app', 'src', 'main', 'res', 'raw');

// ---------------------------------------------------------------- utilities

/** Deterministic PRNG so every run produces byte-identical assets. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
const samples = sec => Math.max(1, Math.round(sec * SR));

/** Mixing buffer: voices are rendered on their own then added at an offset. */
class Mix {
  constructor(seconds) {
    this.data = new Float32Array(samples(seconds));
  }

  add(src, startSec, gain = 1) {
    const off = Math.round(startSec * SR);
    const end = Math.min(this.data.length, off + src.length);
    for (let j = Math.max(0, off); j < end; j++) {
      this.data[j] += src[j - off] * gain;
    }
    return this;
  }

  get length() {
    return this.data.length;
  }
}

/** Peak-normalise with a soft clip so loud sums never crackle. */
function finalize(data, target = 0.89) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.tanh(data[i] * 1.15) / Math.tanh(1.15);
    data[i] = v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  if (peak > 1e-6) {
    const g = target / peak;
    for (let i = 0; i < data.length; i++) data[i] *= g;
  }
  return data;
}

/** Fade the first/last few ms to zero — removes switching clicks. */
function fadeEdges(data, headSec = 0.002, tailSec = 0.02) {
  const head = Math.min(samples(headSec), data.length);
  for (let i = 0; i < head; i++) data[i] *= i / head;
  const tail = Math.min(samples(tailSec), data.length);
  for (let i = 0; i < tail; i++) {
    data[data.length - 1 - i] *= i / tail;
  }
  return data;
}

/**
 * Make a loop seamless: the last `fadeSec` of the render is crossfaded onto the
 * head, and the tail is trimmed, so end→start is continuous.
 */
function makeSeamless(data, fadeSec = 0.06) {
  const f = Math.min(samples(fadeSec), Math.floor(data.length / 4));
  const out = new Float32Array(data.length - f);
  for (let i = 0; i < out.length; i++) {
    if (i < f) {
      const k = i / f;
      out[i] = data[i] * k + data[data.length - f + i] * (1 - k);
    } else {
      out[i] = data[i];
    }
  }
  return out;
}

// ------------------------------------------------------------------- voices

/**
 * Bell / mallet tone: inharmonic partials, each with its own decay rate.
 */
function bell(freq, dur, opts = {}) {
  const {amp = 1, seed = 1, bright = 1, partials} = opts;
  const rnd = mulberry32(seed);
  const n = samples(dur);
  const out = new Float32Array(n);
  const spec =
    partials ??
    [
      [1.0, 1.0, 1.0],
      [2.0, 0.42, 0.72],
      [2.76, 0.3, 0.55],
      [5.4, 0.15, 0.38],
      [8.93, 0.07, 0.26],
    ];
  for (const [mult, pAmp, pDecay] of spec) {
    const f = freq * mult;
    if (f > SR / 2 - 400) continue;
    const tau = Math.max(0.02, (dur * 0.42 * pDecay) / bright);
    const w = (TAU * f) / SR;
    let ph = rnd() * TAU;
    for (let i = 0; i < n; i++) {
      out[i] += Math.sin(ph) * pAmp * Math.exp(-(i / SR) / tau);
      ph += w;
    }
  }
  const atk = samples(0.002);
  for (let i = 0; i < atk; i++) out[i] *= i / atk;
  for (let i = 0; i < n; i++) out[i] *= amp * 0.25;
  return fadeEdges(out);
}

/**
 * Plucked string via Karplus-Strong — used for the harp-like BGM arpeggios.
 */
function pluck(freq, dur, opts = {}) {
  const {amp = 1, seed = 2, damping = 0.9955, bright = 2600} = opts;
  const rnd = mulberry32(seed);
  const n = samples(dur);
  const out = new Float32Array(n);
  const N = Math.max(2, Math.round(SR / freq));
  const ks = new Float32Array(N);
  let lp = 0;
  const a = 1 - Math.exp((-TAU * bright) / SR);
  for (let i = 0; i < N; i++) {
    lp += a * (rnd() * 2 - 1 - lp);
    ks[i] = lp * 1.6;
  }
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const cur = ks[idx];
    ks[idx] = (cur + ks[(idx + 1) % N]) * 0.5 * damping;
    out[i] = cur;
    idx = (idx + 1) % N;
  }
  // Shape the natural KS decay into a defined note length.
  const shape = Math.max(0.08, dur * 0.55);
  for (let i = 0; i < n; i++) {
    out[i] *= Math.exp(-(i / SR) / shape) * amp;
  }
  return fadeEdges(out, 0.001, 0.015);
}

/**
 * Sustained pad built from a limited harmonic stack (alias-free) with gentle
 * detune between harmonics for chorus width.
 */
function pad(freq, dur, opts = {}) {
  const {amp = 1, harmonics = 18, rolloff = 1.7, detune = 6, attack = 0.28} = opts;
  const n = samples(dur);
  const out = new Float32Array(n);
  for (let k = 1; k <= harmonics; k++) {
    const f = freq * k;
    if (f > SR / 2 - 600) break;
    const cents = k % 2 === 0 ? detune : -detune;
    const fk = f * Math.pow(2, cents / 1200);
    const w = (TAU * fk) / SR;
    const pAmp = 1 / Math.pow(k, rolloff);
    let ph = (k * 1.7) % TAU;
    for (let i = 0; i < n; i++) {
      out[i] += Math.sin(ph) * pAmp;
      ph += w;
    }
  }
  const rel = Math.min(0.5, dur * 0.35);
  const atk = samples(Math.min(attack, dur * 0.5));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let e = 1;
    if (i < atk) e = i / atk;
    const left = dur - t;
    if (left < rel) e *= Math.max(0, left / rel);
    out[i] *= e * amp * 0.14;
  }
  return fadeEdges(out, 0.01, 0.02);
}

/** Round bass: fundamental plus a touch of odd harmonics. */
function bass(freq, dur, opts = {}) {
  const {amp = 1, harmonics = 5} = opts;
  const n = samples(dur);
  const out = new Float32Array(n);
  for (let k = 1; k <= harmonics; k += 1) {
    const f = freq * k;
    if (f > SR / 2 - 600) break;
    const w = (TAU * f) / SR;
    const pAmp = 1 / Math.pow(k, 1.9);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      out[i] += Math.sin(ph) * pAmp;
      ph += w;
    }
  }
  const shape = Math.max(0.1, dur * 0.6);
  const atk = samples(0.006);
  for (let i = 0; i < n; i++) {
    let e = Math.exp(-(i / SR) / shape);
    if (i < atk) e *= i / atk;
    out[i] *= e * amp * 0.5;
  }
  return fadeEdges(out, 0.003, 0.02);
}

/** Brass-ish lead for the fanfare: rich harmonic stack with vibrato. */
function brass(freq, dur, opts = {}) {
  const {amp = 1, harmonics = 14, attack = 0.03, release = 0.12, sustain = 0.75} = opts;
  const n = samples(dur);
  const out = new Float32Array(n);
  for (let k = 1; k <= harmonics; k++) {
    const f = freq * k;
    if (f > SR / 2 - 600) break;
    const pAmp = 1 / Math.pow(k, 1.25);
    let ph = 0;
    const w = (TAU * f) / SR;
    for (let i = 0; i < n; i++) {
      const vib = 1 + 0.004 * Math.sin((TAU * 5.2 * i) / SR);
      out[i] += Math.sin(ph) * pAmp;
      ph += w * vib;
    }
  }
  const atk = samples(attack);
  const rel = samples(Math.min(release, dur * 0.6));
  for (let i = 0; i < n; i++) {
    let e = sustain;
    if (i < atk) e = i / atk;
    const left = n - i;
    if (left < rel) e *= left / rel;
    out[i] *= e * amp * 0.3;
  }
  return fadeEdges(out, 0.004, 0.02);
}

/** Raspy detuned buzz with downward glide — the wrong-answer sting. */
function buzz(f0, f1, dur, opts = {}) {
  const {amp = 1, harmonics = 12, glide = 1} = opts;
  const n = samples(dur);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const k = Math.pow(t / dur, 0.75) * glide;
    const f = f0 + (f1 - f0) * Math.min(1, k);
    let v = 0;
    for (let h = 1; h <= harmonics; h++) {
      const fh = f * h * (h % 2 === 0 ? 1.004 : 1);
      if (fh > SR / 2 - 600) break;
      v += Math.sin(phase * h) / Math.pow(h, 1.35);
    }
    const am = 0.75 + 0.25 * Math.sin((TAU * 15 * t) / 1);
    out[i] = Math.tanh(v * 1.6) * am;
    phase += (TAU * f) / SR;
  }
  const shape = Math.max(0.08, dur * 0.42);
  for (let i = 0; i < n; i++) {
    let e = Math.exp(-(i / SR) / shape);
    if (i < samples(0.004)) e *= i / samples(0.004);
    out[i] *= e * amp * 0.42;
  }
  return fadeEdges(out, 0.003, 0.025);
}

// -------------------------------------------------------------- percussion

function kick(dur = 0.34, opts = {}) {
  const {amp = 1, f0 = 125, f1 = 44} = opts;
  const n = samples(dur);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.035);
    out[i] = Math.sin(ph) * Math.exp(-t / 0.11);
    ph += (TAU * f) / SR;
  }
  const rnd = mulberry32(9);
  const clickN = samples(0.01);
  for (let i = 0; i < clickN; i++) {
    out[i] += (rnd() * 2 - 1) * 0.35 * (1 - i / clickN);
  }
  for (let i = 0; i < n; i++) out[i] *= amp * 0.85;
  return fadeEdges(out, 0.001, 0.02);
}

function hat(dur = 0.06, opts = {}) {
  const {amp = 1, seed = 5, cutoff = 6500} = opts;
  const rnd = mulberry32(seed);
  const n = samples(dur);
  const out = new Float32Array(n);
  let lp = 0;
  const a = 1 - Math.exp((-TAU * cutoff) / SR);
  for (let i = 0; i < n; i++) {
    const x = rnd() * 2 - 1;
    lp += a * (x - lp);
    out[i] = (x - lp) * Math.exp(-(i / SR) / 0.016);
  }
  for (let i = 0; i < n; i++) out[i] *= amp * 0.5;
  return fadeEdges(out, 0.0008, 0.008);
}

function snare(dur = 0.16, opts = {}) {
  const {amp = 1, seed = 7} = opts;
  const rnd = mulberry32(seed);
  const n = samples(dur);
  const out = new Float32Array(n);
  let lp = 0;
  const a = 1 - Math.exp((-TAU * 2200) / SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = rnd() * 2 - 1;
    lp += a * (x - lp);
    out[i] =
      (x - lp * 0.6) * Math.exp(-t / 0.055) * 0.7 +
      Math.sin(TAU * 190 * t) * Math.exp(-t / 0.04) * 0.5;
  }
  for (let i = 0; i < n; i++) out[i] *= amp * 0.5;
  return fadeEdges(out, 0.0008, 0.015);
}

/** Rising tension riser: filtered noise sweep + pitch rise + tremolo. */
function riser(dur, opts = {}) {
  const {amp = 1, seed = 11, from = 220, to = 3600, cutoffFrom = 260, cutoffTo = 7000} = opts;
  const rnd = mulberry32(seed);
  const n = samples(dur);
  const out = new Float32Array(n);
  let lp = 0;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const p = t / dur;
    const cutoff = cutoffFrom * Math.pow(cutoffTo / cutoffFrom, p);
    const a = 1 - Math.exp((-TAU * cutoff) / SR);
    const x = rnd() * 2 - 1;
    lp += a * (x - lp);
    const f = from * Math.pow(to / from, p);
    const tone = Math.sin(ph) * 0.5;
    ph += (TAU * f) / SR;
    const trem = 0.75 + 0.25 * Math.sin(TAU * (6 + 10 * p) * t);
    out[i] = (lp * 1.3 + tone) * trem * Math.pow(p, 1.4);
  }
  // Hard stop at the end so the reveal lands on a clean transient.
  const rel = samples(0.05);
  for (let i = 0; i < rel; i++) out[n - 1 - i] *= i / rel;
  for (let i = 0; i < n; i++) out[i] *= amp * 0.6;
  return fadeEdges(out, 0.01, 0.01);
}

// ------------------------------------------------------------------ effects

function sfxClick() {
  const rnd = mulberry32(21);
  const m = new Mix(0.1);
  const n = samples(0.02);
  const noise = new Float32Array(n);
  let lp = 0;
  const a = 1 - Math.exp((-TAU * 3500) / SR);
  for (let i = 0; i < n; i++) {
    lp += a * (rnd() * 2 - 1 - lp);
    noise[i] = lp * (1 - i / n);
  }
  m.add(noise, 0, 1);
  m.add(bell(1760, 0.09, {amp: 1, seed: 22, bright: 1.6}), 0, 1);
  m.add(bell(2640, 0.06, {amp: 0.6, seed: 23, bright: 1.8}), 0.004, 1);
  return finalize(m.data, 0.72);
}

/** Answer locked in: low thud plus a menacing rising minor second. */
function sfxLock() {
  const m = new Mix(0.55);
  m.add(kick(0.4, {amp: 1.1, f0: 150, f1: 52}), 0, 1);
  m.add(bell(146.83, 0.5, {amp: 1, seed: 31, bright: 0.55}), 0.01, 1);
  m.add(bell(155.56, 0.45, {amp: 0.8, seed: 32, bright: 0.55}), 0.16, 1);
  m.add(pad(73.42, 0.5, {amp: 1, harmonics: 10, rolloff: 1.9, attack: 0.02}), 0, 1);
  return finalize(m.data, 0.82);
}

/** The reveal-window sting: a short orchestral-ish riser plus a low pulse. */
function sfxSuspense() {
  const m = new Mix(1.32);
  m.add(riser(1.22, {amp: 1}), 0.0, 1);
  // accelerating heartbeat under the riser
  const beats = [0.0, 0.34, 0.62, 0.86, 1.06, 1.2];
  beats.forEach((t, i) => {
    m.add(kick(0.3, {amp: 0.5 + i * 0.06, f0: 110, f1: 42}), t, 1);
  });
  m.add(pad(55, 1.3, {amp: 0.9, harmonics: 12, rolloff: 2.0, attack: 0.6}), 0, 1);
  return finalize(m.data, 0.85);
}

/** Correct answer: ascending major arpeggio with bell timbre. */
function sfxCorrect() {
  const m = new Mix(1.2);
  const notes = [72, 76, 79, 84];
  notes.forEach((midi, i) => {
    const t = i * 0.085;
    m.add(bell(midiToFreq(midi), 0.95 - i * 0.08, {amp: 1, seed: 41 + i, bright: 1.1}), t, 1);
  });
  m.add(pluck(midiToFreq(84), 0.7, {amp: 0.7, seed: 51}), 0.34, 1);
  return finalize(m.data, 0.86);
}

/** Wrong answer: descending rasp with a low thud. */
function sfxWrong() {
  const m = new Mix(0.95);
  m.add(buzz(196, 98, 0.85, {amp: 1, harmonics: 14}), 0, 1);
  m.add(kick(0.5, {amp: 1, f0: 120, f1: 38}), 0, 1);
  m.add(bell(98, 0.6, {amp: 0.9, seed: 61, bright: 0.5}), 0.05, 1);
  return finalize(m.data, 0.86);
}

/** Lifeline used: bright shimmer sweep. */
function sfxLifeline() {
  const rnd = mulberry32(71);
  const m = new Mix(0.7);
  const n = samples(0.62);
  const shimmer = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const cutoff = 1200 * Math.pow(9000 / 1200, p);
    const a = 1 - Math.exp((-TAU * cutoff) / SR);
    lp += a * (rnd() * 2 - 1 - lp);
    shimmer[i] = lp * Math.sin(Math.PI * Math.min(1, p * 1.25)) * 0.9;
  }
  m.add(shimmer, 0, 1);
  [88, 91, 95, 100].forEach((midi, i) => {
    m.add(bell(midiToFreq(midi), 0.4, {amp: 0.55, seed: 81 + i, bright: 1.7}), i * 0.045, 1);
  });
  return finalize(m.data, 0.8);
}

/** Millionaire fanfare. */
function sfxWin() {
  const m = new Mix(2.7);
  const pickup = [67, 72, 76, 79];
  pickup.forEach((midi, i) => {
    m.add(brass(midiToFreq(midi), 0.2, {amp: 0.85, sustain: 0.6, release: 0.06}), i * 0.13, 1);
  });
  const finale = 0.56;
  [72, 76, 79, 84].forEach((midi, i) => {
    m.add(brass(midiToFreq(midi), 1.9, {amp: 0.95, sustain: 0.8, release: 0.5}), finale, 1);
    m.add(bell(midiToFreq(midi + 12), 1.7, {amp: 0.5, seed: 91 + i, bright: 1.3}), finale, 1);
  });
  m.add(kick(0.4, {amp: 1, f0: 130, f1: 46}), finale, 1);
  m.add(snare(0.3, {amp: 0.7, seed: 95}), finale, 1);
  // sparkle tail
  [96, 100, 103, 108].forEach((midi, i) => {
    m.add(bell(midiToFreq(midi), 0.9, {amp: 0.32, seed: 101 + i, bright: 2}), finale + 0.1 + i * 0.07, 1);
  });
  return finalize(m.data, 0.9);
}

/** Consolation: slow descending trombone-ish phrase. */
function sfxLose() {
  const m = new Mix(1.7);
  const phrase = [69, 65, 62, 57];
  phrase.forEach((midi, i) => {
    m.add(
      brass(midiToFreq(midi), i === phrase.length - 1 ? 0.9 : 0.42, {
        amp: 0.8,
        sustain: 0.62,
        attack: 0.05,
        release: i === phrase.length - 1 ? 0.5 : 0.1,
        harmonics: 11,
      }),
      i * 0.34,
      1,
    );
  });
  m.add(buzz(150, 74, 1.2, {amp: 0.5, harmonics: 10, glide: 0.8}), 1.0, 1);
  m.add(kick(0.6, {amp: 0.8, f0: 100, f1: 34}), 1.32, 1);
  return finalize(m.data, 0.84);
}

// ---------------------------------------------------------------------- BGM

/**
 * Shared chord-driven loop builder. `spec` describes the arrangement; both BGM
 * tracks are assembled from the same vocabulary so they feel like one score.
 */
function buildLoop({bpm, bars, chords, voices}) {
  const beat = 60 / bpm;
  const bar = beat * 4;
  const total = bar * bars;
  const m = new Mix(total + 1.5);
  const rnd = mulberry32(1234);

  chords.forEach((chord, barIndex) => {
    const t0 = barIndex * bar;
    if (voices.pad) {
      chord.notes.forEach((midi, i) => {
        m.add(
          pad(midiToFreq(midi), bar * 1.02, {
            amp: voices.pad.amp,
            harmonics: voices.pad.harmonics ?? 16,
            rolloff: voices.pad.rolloff ?? 1.7,
            attack: voices.pad.attack ?? 0.3,
            detune: 5 + i,
          }),
          t0,
          1,
        );
      });
    }
    if (voices.bass) {
      const pattern = voices.bass.pattern;
      pattern.forEach(({beat: b, octave = 0, amp = 1}) => {
        const midi = chord.bass + octave * 12;
        const dur = beat * (voices.bass.length ?? 1.8);
        m.add(bass(midiToFreq(midi), dur, {amp: voices.bass.amp * amp}), t0 + b * beat, 1);
      });
    }
    if (voices.arp) {
      const steps = voices.arp.steps;
      const step = beat / (voices.arp.perBeat ?? 2);
      for (let s = 0; s < steps; s++) {
        const tone = voices.arp.pattern[s % voices.arp.pattern.length];
        const midi = chord.notes[tone.index] + (tone.octave ?? 0) * 12;
        const amp = voices.arp.amp * (tone.amp ?? 1) * (0.86 + rnd() * 0.2);
        m.add(
          pluck(midiToFreq(midi), step * (voices.arp.length ?? 3), {
            amp,
            seed: 200 + barIndex * 16 + s,
            damping: voices.arp.damping ?? 0.9955,
          }),
          t0 + s * step,
          1,
        );
      }
    }
    if (voices.drums) {
      voices.drums.kick.forEach(b => m.add(kick(0.34, {amp: voices.drums.amp}), t0 + b * beat, 1));
      voices.drums.snare.forEach(b =>
        m.add(snare(0.18, {amp: voices.drums.amp * 0.8, seed: 300 + barIndex}), t0 + b * beat, 1),
      );
      for (let h = 0; h < 8; h++) {
        if (!voices.drums.hats.includes(h)) continue;
        m.add(hat(0.06, {amp: voices.drums.amp * 0.7, seed: 400 + h}), t0 + (h * beat) / 2, 1);
      }
    }
    if (voices.bells) {
      voices.bells.forEach(({beat: b, index, octave = 1, amp = 1}) => {
        const midi = chord.notes[index] + octave * 12;
        m.add(bell(midiToFreq(midi), 1.6, {amp: 0.34 * amp, seed: 500 + barIndex * 8 + index, bright: 1.4}), t0 + b * beat, 1);
      });
    }
  });

  const loop = makeSeamless(m.data.slice(0, samples(total)), 0.08);
  return finalize(loop, 0.82);
}

// Note names → MIDI numbers used by the chord tables below.
const D3 = 50, E3 = 52, F3 = 53, G3 = 55, GS3 = 56, A3 = 57, B3 = 59;
const C4 = 60, D4 = 62, E4 = 64;

/** Calm, mysterious menu bed: Am F C G Am F Dm E. */
function bgmMenu() {
  return buildLoop({
    bpm: 90,
    bars: 8,
    chords: [
      {notes: [A3, C4, E4], bass: 45},
      {notes: [F3, A3, C4], bass: 41},
      {notes: [E3, G3, C4], bass: 48},
      {notes: [G3, B3, D4], bass: 43},
      {notes: [A3, C4, E4], bass: 45},
      {notes: [F3, A3, C4], bass: 41},
      {notes: [D3, F3, A3], bass: 38},
      {notes: [E3, GS3, B3], bass: 40},
    ],
    voices: {
      pad: {amp: 1, harmonics: 16, rolloff: 1.75, attack: 0.35},
      bass: {amp: 0.9, length: 2.2, pattern: [{beat: 0}, {beat: 2}]},
      arp: {
        amp: 0.5,
        perBeat: 2,
        steps: 8,
        length: 3.2,
        pattern: [
          {index: 0, octave: 1},
          {index: 1, octave: 1},
          {index: 2, octave: 1},
          {index: 0, octave: 2, amp: 0.8},
          {index: 2, octave: 1},
          {index: 1, octave: 1, amp: 0.85},
          {index: 2, octave: 2, amp: 0.7},
          {index: 1, octave: 1, amp: 0.75},
        ],
      },
      bells: [{beat: 2, index: 2, octave: 2, amp: 0.8}],
    },
  });
}

/** Tense in-game bed: driving 16ths, pulse bass, soft backbeat. */
function bgmGame() {
  return buildLoop({
    bpm: 104,
    bars: 8,
    chords: [
      {notes: [A3, C4, E4], bass: 45},
      {notes: [F3, A3, C4], bass: 41},
      {notes: [G3, B3, D4], bass: 43},
      {notes: [E3, GS3, B3], bass: 40},
      {notes: [A3, C4, E4], bass: 45},
      {notes: [F3, A3, C4], bass: 41},
      {notes: [D3, F3, A3], bass: 38},
      {notes: [E3, GS3, B3], bass: 40},
    ],
    voices: {
      pad: {amp: 0.75, harmonics: 14, rolloff: 1.9, attack: 0.22},
      bass: {
        amp: 1,
        length: 0.9,
        pattern: [
          {beat: 0},
          {beat: 0.5},
          {beat: 1, octave: 0, amp: 0.8},
          {beat: 1.5},
          {beat: 2},
          {beat: 2.5, amp: 0.8},
          {beat: 3},
          {beat: 3.5, octave: 1, amp: 0.7},
        ],
      },
      arp: {
        amp: 0.42,
        perBeat: 4,
        steps: 16,
        length: 2.4,
        damping: 0.994,
        pattern: [
          {index: 0, octave: 1},
          {index: 2, octave: 1},
          {index: 1, octave: 1},
          {index: 2, octave: 1, amp: 0.8},
        ],
      },
      drums: {
        amp: 0.8,
        kick: [0, 2],
        snare: [1, 3],
        hats: [0, 2, 4, 6],
      },
      bells: [{beat: 3, index: 1, octave: 2, amp: 0.55}],
    },
  });
}

// ------------------------------------------------------------------ writing

function writeWav(file, data) {
  const n = data.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  return buf.length;
}

function stats(data) {
  let peak = 0;
  let sum = 0;
  let dc = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
    dc += v;
  }
  return {
    seconds: (data.length / SR).toFixed(2),
    peak: peak.toFixed(3),
    rms: Math.sqrt(sum / data.length).toFixed(3),
    dc: (dc / data.length).toFixed(5),
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const assets = [
    ['sfx_click', sfxClick()],
    ['sfx_lock', sfxLock()],
    ['sfx_suspense', sfxSuspense()],
    ['sfx_correct', sfxCorrect()],
    ['sfx_wrong', sfxWrong()],
    ['sfx_lifeline', sfxLifeline()],
    ['sfx_win', sfxWin()],
    ['sfx_lose', sfxLose()],
    ['bgm_menu', bgmMenu()],
    ['bgm_game', bgmGame()],
  ];

  let total = 0;
  console.log(`Writing ${assets.length} assets to ${OUT_DIR}\n`);
  console.log('name'.padEnd(16), 'secs'.padStart(6), 'peak'.padStart(6), 'rms'.padStart(6), 'dc'.padStart(9), 'kb'.padStart(7));
  for (const [name, data] of assets) {
    for (let i = 0; i < data.length; i++) {
      if (!Number.isFinite(data[i])) {
        throw new Error(`${name}: non-finite sample at index ${i}`);
      }
    }
    const file = path.join(OUT_DIR, `${name}.wav`);
    const bytes = writeWav(file, data);
    total += bytes;
    const s = stats(data);
    console.log(
      name.padEnd(16),
      s.seconds.padStart(6),
      s.peak.padStart(6),
      s.rms.padStart(6),
      s.dc.padStart(9),
      (bytes / 1024).toFixed(0).padStart(7),
    );
  }
  console.log(`\nTotal: ${(total / 1024 / 1024).toFixed(2)} MB`);
}

main();
