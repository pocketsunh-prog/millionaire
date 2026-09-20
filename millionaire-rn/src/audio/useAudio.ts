import {useCallback, useSyncExternalStore} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import * as audio from './audioManager';
import type {AudioSettings, BgmTrack} from './audioManager';

/**
 * React bindings for the audio manager.
 *
 * `useAudioSettings` re-renders a screen whenever music/effect preferences change
 * (so the Settings screen is always in sync), and `useBgm` keeps the right music
 * track playing for whichever screen is focused.
 */

export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(audio.subscribe, audio.getSettings);
}

/**
 * Play `track` for as long as this screen is focused. Switching between screens
 * that share a track does not restart the music.
 */
export function useBgm(track: BgmTrack): void {
  useFocusEffect(
    useCallback(() => {
      audio.playBgm(track);
    }, [track]),
  );
}
