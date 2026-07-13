export const AUTH_REFRESH_EVENT = 'auth:refresh';
export const AUTH_REFRESH_STORAGE_KEY = 'crm.auth.refresh';

export function broadcastAuthRefresh() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));

  try {
    window.localStorage.setItem(AUTH_REFRESH_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore storage write failures.
  }
}