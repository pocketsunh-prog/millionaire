import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules} from 'react-native';

/**
 * Audio front-end for the Android build.
 *
 * The actual playback happens in the native `SoundModule` (SoundPool for effects,
 * a looping MediaPlayer for music). This module owns everything the user can
 * change — music on/off, effect on/off and their volumes — persists it, and
 * translates screen-level calls into native ones.
 *
 * Every function is safe to call when the native module is unavailable (e.g. iOS
 * or a JS-only test run): audio simply becomes a no-op instead of crashing.
 */

export type SfxName =
  | 'click'
  | 'lock'
  | 'suspense'
  | 'correct'
  | 'wrong'
  | 'lifeline'
  | 'win'
  | 'lose';

export type BgmTrack = 'menu' | 'game';

export interface AudioSettings {
  /** Background music master switch. */
  musicEnabled: boolean;
  /** Sound-effect master switch. */
  sfxEnabled: boolean;
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  sfxVolume: number;
}

const STORAGE_KEY = 'millionaire_audio_settings';

const DEFAULT_SETTINGS: AudioSettings = {
  musicEnabled: true,
  sfxEnabled: true,
  // Music sits under the effects and the show's stings.
  musicVolume: 0.5,
  sfxVolume: 0.9,
};

/** Effect name → packaged raw resource (see tools/generate-audio.js). */
const SFX_RESOURCE: Record<SfxName, string> = {
  click: 'sfx_click',
  lock: 'sfx_lock',
  suspense: 'sfx_suspense',
  correct: 'sfx_correct',
  wrong: 'sfx_wrong',
  lifeline: 'sfx_lifeline',
  win: 'sfx_win',
  lose: 'sfx_lose',
};

/** Music track → packaged raw resource. */
const BGM_RESOURCE: Record<BgmTrack, string> = {
  menu: 'bgm_menu',
  game: 'bgm_game',
};

interface SoundNativeModule {
  preloadSfx(names: string[]): void;
  playSfx(name: string, volume: number): void;
  setSfxVolume(volume: number): void;
  playBgm(name: string, volume: number, loop: boolean): void;
  stopBgm(): void;
  pauseBgm(): void;
  resumeBgm(): void;
  setBgmVolume(volume: number): void;
}

const native: SoundNativeModule | null =
  (NativeModules as {SoundModule?: SoundNativeModule}).SoundModule ?? null;

if (!native && __DEV__) {
  console.warn(
    '[audio] SoundModule is unavailable — music and sound effects are disabled. ' +
      'This is expected on iOS; on Android rebuild the app.',
  );
}

// ------------------------------------------------------------------- store

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

let settings: AudioSettings = {...DEFAULT_SETTINGS};
/** Stable identity for useSyncExternalStore — only replaced on real changes. */
let snapshot: AudioSettings = settings;
const listeners = new Set<() => void>();

/** What the current screen asked for, independent of pause/enable state. */
let desiredTrack: BgmTrack | null = null;
/** True while music is temporarily paused (e.g. under the reveal sting). */
let musicPaused = false;
let initialised = false;

function commit(next: AudioSettings): void {
  settings = next;
  snapshot = settings;
  listeners.forEach(listener => listener());
}

function normalise(raw: Partial<AudioSettings> | null): AudioSettings {
  if (!raw) {
    return {...DEFAULT_SETTINGS};
  }
  return {
    musicEnabled: raw.musicEnabled !== false,
    sfxEnabled: raw.sfxEnabled !== false,
    musicVolume: clamp(
      typeof raw.musicVolume === 'number'
        ? raw.musicVolume
        : DEFAULT_SETTINGS.musicVolume,
    ),
    sfxVolume: clamp(
      typeof raw.sfxVolume === 'number'
        ? raw.sfxVolume
        : DEFAULT_SETTINGS.sfxVolume,
    ),
  };
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage is best effort — the session keeps the in-memory values.
  }
}

/** Current settings. Reference is stable until something actually changes. */
export const getSettings = (): AudioSettings => snapshot;

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// ------------------------------------------------------------------ startup

/** Load saved preferences, warm up the effects and start any pending music. */
export async function initAudio(): Promise<void> {
  if (initialised) {
    return;
  }
  initialised = true;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    commit(normalise(raw ? (JSON.parse(raw) as Partial<AudioSettings>) : null));
  } catch {
    commit({...DEFAULT_SETTINGS});
  }

  if (native) {
    native.preloadSfx(Object.values(SFX_RESOURCE));
    native.setSfxVolume(settings.sfxVolume);
    native.setBgmVolume(settings.musicVolume);
  }
  applyMusic();
}

// ------------------------------------------------------------------ effects

/** Play a one-shot effect. [volume] scales the user's effect level. */
export function playSfx(name: SfxName, volume = 1): void {
  if (!native || !settings.sfxEnabled) {
    return;
  }
  native.playSfx(SFX_RESOURCE[name], clamp(volume));
}

export async function setSfxEnabled(enabled: boolean): Promise<void> {
  commit({...settings, sfxEnabled: enabled});
  await persist();
}

export async function setSfxVolume(volume: number): Promise<void> {
  commit({...settings, sfxVolume: clamp(volume)});
  native?.setSfxVolume(settings.sfxVolume);
  await persist();
}

// -------------------------------------------------------------------- music

function applyMusic(): void {
  if (!native) {
    return;
  }
  if (!settings.musicEnabled || !desiredTrack) {
    native.stopBgm();
    return;
  }
  if (musicPaused) {
    native.pauseBgm();
    return;
  }
  // The native side resumes the track if it is already loaded, so calling this
  // repeatedly for the same screen is cheap and does not restart the music.
  native.playBgm(BGM_RESOURCE[desiredTrack], settings.musicVolume, true);
}

/** Use `track` for the screen that is now visible. */
export function playBgm(track: BgmTrack): void {
  desiredTrack = track;
  applyMusic();
}

/** Pause music without forgetting the track (used under the reveal sting). */
export function pauseBgm(): void {
  musicPaused = true;
  native?.pauseBgm();
}

/** Undo [pauseBgm]. */
export function resumeBgm(): void {
  if (!musicPaused) {
    return;
  }
  musicPaused = false;
  applyMusic();
}

/** Stop music and forget the track. */
export function stopBgm(): void {
  desiredTrack = null;
  musicPaused = false;
  native?.stopBgm();
}

export async function setMusicEnabled(enabled: boolean): Promise<void> {
  commit({...settings, musicEnabled: enabled});
  applyMusic();
  await persist();
}

export async function setMusicVolume(volume: number): Promise<void> {
  commit({...settings, musicVolume: clamp(volume)});
  native?.setBgmVolume(settings.musicVolume);
  await persist();
}

/**
 * Stop music and allow [initAudio] to run again.
 *
 * This deliberately does not release the native engine: the module lives for as
 * long as the React instance does and cleans itself up in its own teardown, so a
 * dev reload cannot leave the app permanently mute.
 */
export function releaseAudio(): void {
  stopBgm();
  initialised = false;
}
