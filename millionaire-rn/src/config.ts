import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * API server configuration.
 *
 * The backend is the Express server in ../millionaire-game (default port 8080).
 *
 * - Android emulator reaches the host machine's localhost via 10.0.2.2
 * - A physical device needs your PC's LAN IP, e.g. http://192.168.1.50:8080
 *
 * The URL can be changed at runtime from the in-app Settings screen (gear icon
 * on the Home screen) — no rebuild needed. This module is the fallback default
 * used when no override has been saved.
 */
export const DEFAULT_API_BASE_URL: string = 'http://192.168.128.140:8080';

const API_BASE_URL_KEY = 'millionaire_api_base_url';

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Current effective base URL (saved override, or the default). */
export async function getApiBaseUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(API_BASE_URL_KEY);
    if (stored && stored.trim()) {
      return normalizeBaseUrl(stored);
    }
  } catch {
    // storage unavailable — fall through to default
  }
  return DEFAULT_API_BASE_URL;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(API_BASE_URL_KEY, normalizeBaseUrl(url));
}

export async function resetApiBaseUrl(): Promise<void> {
  await AsyncStorage.removeItem(API_BASE_URL_KEY);
}
