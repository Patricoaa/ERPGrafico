const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function removeCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function setClientToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCESS_KEY, token);
    setCookie(ACCESS_KEY, token, COOKIE_MAX_AGE);
  } catch {}
}

export function setClientRefreshToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REFRESH_KEY, token);
  } catch {}
}

export function removeClientTokens(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    removeCookie(ACCESS_KEY);
  } catch {}
}

export function getClientToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}
