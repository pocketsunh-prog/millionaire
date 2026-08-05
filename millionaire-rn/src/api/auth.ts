import { api, setToken } from './client';
import type { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export async function login(
  usernameOrEmail: string,
  password: string,
): Promise<User> {
  const data = await api.post<AuthResponse>('/api/auth/login', {
    username: usernameOrEmail,
    password,
  });
  await setToken(data.token);
  return data.user;
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<User> {
  const data = await api.post<AuthResponse>('/api/auth/register', {
    username,
    email,
    password,
  });
  await setToken(data.token);
  return data.user;
}

export async function fetchMe(): Promise<User> {
  return api.get<User>('/api/auth/me');
}

export async function logout(): Promise<void> {
  try {
    await api.post('/api/auth/logout');
  } catch {
    // ignore network errors while logging out
  } finally {
    await setToken(null);
  }
}

export async function updateAvatar(avatar: string): Promise<void> {
  await api.put('/api/auth/avatar', {avatar});
}
