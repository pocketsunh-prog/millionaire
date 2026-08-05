import AsyncStorage from '@react-native-async-storage/async-storage';
import {getApiBaseUrl} from '../config';

const TOKEN_KEY = 'millionaire_token';

/**
 * Timeout for every request. Keeps offline/fallback paths snappy: when the
 * server is unreachable the request aborts after this long instead of hanging
 * for tens of seconds.
 */
const REQUEST_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const baseUrl = await getApiBaseUrl();

  // Abort the request after REQUEST_TIMEOUT_MS so unreachable servers fail
  // fast (offline fallback, error messages) instead of hanging.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      `Cannot reach server at ${baseUrl}. Is the backend running?`,
      0,
    );
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && data.error) ||
      `Request failed (${res.status})`;
    throw new ApiError(String(message), res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {method: 'POST', body: JSON.stringify(body ?? {})}),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {method: 'PUT', body: JSON.stringify(body ?? {})}),
  del: <T>(path: string) => request<T>(path, {method: 'DELETE'}),
};
