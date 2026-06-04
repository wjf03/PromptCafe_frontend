import { apiRequest, clearToken, getRefreshToken, getToken, setRefreshToken, setToken } from "./http";
import type { AuthTokenData, User } from "./types";

const USER_KEY = "promptcafe_user";

function readStoredUserRaw(): string | null {
  const fromLocal = localStorage.getItem(USER_KEY);
  if (fromLocal) return fromLocal;
  const fromSession = sessionStorage.getItem(USER_KEY);
  if (!fromSession) return null;
  localStorage.setItem(USER_KEY, fromSession);
  sessionStorage.removeItem(USER_KEY);
  return fromSession;
}

export function getStoredUser(): User | null {
  const raw = readStoredUserRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setStoredUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.removeItem(USER_KEY);
}

export function clearSession() {
  clearToken();
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function isAdmin(): boolean {
  return getStoredUser()?.role === "admin";
}

function storeAuth(data: AuthTokenData): AuthTokenData {
  setToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  setStoredUser(data.user);
  return data;
}

export async function login(body: { account: string; password: string }): Promise<AuthTokenData> {
  const data = (await apiRequest<AuthTokenData>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body)
  })) as AuthTokenData;
  return storeAuth(data);
}

export async function register(body: {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}): Promise<AuthTokenData> {
  const data = (await apiRequest<AuthTokenData>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body)
  })) as AuthTokenData;
  return storeAuth(data);
}

export async function refreshToken(): Promise<string> {
  const refreshTokenValue = getRefreshToken();
  if (!refreshTokenValue) throw new Error("缺少 refreshToken");
  const data = (await apiRequest<{ accessToken: string; accessTokenExpiresIn?: number }>("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: refreshTokenValue })
  })) as { accessToken: string; accessTokenExpiresIn?: number };
  setToken(data.accessToken);
  return data.accessToken;
}

export async function logout(): Promise<void> {
  const refreshTokenValue = getRefreshToken();
  try {
    await apiRequest("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify(refreshTokenValue ? { refreshToken: refreshTokenValue } : {})
    });
  } finally {
    clearSession();
  }
}

export async function getAuthMe(): Promise<User> {
  const user = (await apiRequest<User>("/api/auth/me")) as User;
  setStoredUser(user);
  return user;
}

export async function getMyProfile(): Promise<User> {
  const user = (await apiRequest<User>("/api/users/me")) as User;
  setStoredUser(user);
  return user;
}

export async function updateMyProfile(body: {
  nickname?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
}): Promise<User> {
  const user = (await apiRequest<User>("/api/users/me", {
    method: "PUT",
    body: JSON.stringify(body)
  })) as User;
  setStoredUser(user);
  return user;
}
