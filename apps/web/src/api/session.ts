import { AUTH_REFRESH_TOKEN_KEY, AUTH_TOKEN_KEY, AUTH_USERNAME_KEY } from "../lib/constants";

// plain module-level store (not React state) so the silent-refresh logic in
// client.ts — which runs outside any component — can update the session and
// have AuthContext pick up the change via subscribe()
type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((fn) => fn());
}

export function getAccessToken(): string | null {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return window.localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
}

export function getUsername(): string | null {
  return window.localStorage.getItem(AUTH_USERNAME_KEY);
}

export function setSession(token: string, refreshToken: string, username: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
  window.localStorage.setItem(AUTH_USERNAME_KEY, username);
  notify();
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  notify();
}

export function clearSession() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USERNAME_KEY);
  notify();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
