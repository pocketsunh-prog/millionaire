import AsyncStorage from '@react-native-async-storage/async-storage';
import {sha256} from 'js-sha256';
import type {User} from '../types';

/**
 * Local credential cache for offline login.
 *
 * On every successful online login/register we store a salted hash of the
 * password plus the user profile. When the server is unreachable, the Login
 * screen verifies the typed credentials against this cache and restores the
 * session. The plaintext password is never stored.
 */

const CREDENTIALS_KEY = 'millionaire_credentials';

interface CachedCredential {
  username: string;
  email: string | null;
  /** sha256(`${username}|${password}`) */
  hash: string;
  user: User;
}

function hashPassword(password: string, username: string): string {
  return sha256(`${username}|${password}`);
}

async function readCredentials(): Promise<CachedCredential[]> {
  try {
    const raw = await AsyncStorage.getItem(CREDENTIALS_KEY);
    return raw ? (JSON.parse(raw) as CachedCredential[]) : [];
  } catch {
    return [];
  }
}

/** Store/update a credential entry after a successful online login. */
export async function saveCredentials(
  user: User,
  password: string,
): Promise<void> {
  const list = await readCredentials();
  const entry: CachedCredential = {
    username: user.username,
    email: user.email,
    hash: hashPassword(password, user.username),
    user,
  };
  const next = [entry, ...list.filter(c => c.username !== user.username)];
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(next));
}

/**
 * Verify credentials against the local cache (offline login).
 * Returns the cached user profile on match, null otherwise.
 */
export async function verifyOfflineCredentials(
  identifier: string,
  password: string,
): Promise<User | null> {
  if (!identifier.trim() || !password) {
    return null;
  }
  const list = await readCredentials();
  const entry = list.find(
    c =>
      c.username.toLowerCase() === identifier.trim().toLowerCase() ||
      (c.email != null &&
        c.email.toLowerCase() === identifier.trim().toLowerCase()),
  );
  if (!entry) {
    return null;
  }
  if (hashPassword(password, entry.username) !== entry.hash) {
    return null;
  }
  return entry.user;
}
