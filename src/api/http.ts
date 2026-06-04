import type { ApiErrorBody } from "./types";

const TOKEN_KEY = "promptcafe_token";
const REFRESH_TOKEN_KEY = "promptcafe_refresh_token";
const GUEST_SESSION_KEY = "promptcafe_guest_session_id";

/** 登录态持久化到 localStorage，便于新标签页与浏览器重启后保持登录 */
function readPersistedAuth(key: string): string | null {
  const fromLocal = localStorage.getItem(key);
  if (fromLocal) return fromLocal;
  const fromSession = sessionStorage.getItem(key);
  if (!fromSession) return null;
  localStorage.setItem(key, fromSession);
  sessionStorage.removeItem(key);
  return fromSession;
}

function writePersistedAuth(key: string, value: string) {
  localStorage.setItem(key, value);
  sessionStorage.removeItem(key);
}

function removePersistedAuth(key: string) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export function getToken(): string | null {
  return readPersistedAuth(TOKEN_KEY);
}

export function setToken(token: string) {
  writePersistedAuth(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return readPersistedAuth(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string) {
  writePersistedAuth(REFRESH_TOKEN_KEY, token);
}

export function clearToken() {
  removePersistedAuth(TOKEN_KEY);
  removePersistedAuth(REFRESH_TOKEN_KEY);
}

export function getGuestSessionId(): string {
  let sessionId = sessionStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    const randomId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionId = `guest:${randomId}`;
    sessionStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }
  return sessionId;
}

function baseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  return typeof v === "string" && v.length > 0 ? v.replace(/\/$/, "") : "";
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function isAuthPath(path: string): boolean {
  const p = normalizePath(path);
  return p === "/api/auth/login" || p === "/api/auth/register" || p === "/api/auth/refresh";
}

let refreshInFlight: Promise<string | null> | null = null;

async function requestNewAccessToken(refreshTokenValue: string): Promise<string | null> {
  const url = `${baseUrl()}/api/auth/refresh`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshTokenValue })
    });
    if (res.status === 204) return null;

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return null;
    }

    const envelope = json as {
      data?: { accessToken?: string };
      code?: string | number;
      message?: string;
    };

    if (!("code" in envelope && "message" in envelope)) return null;

    const numericCode = typeof envelope.code === "number" ? envelope.code : Number(envelope.code);
    if (!res.ok || numericCode >= 400) return null;

    const accessToken = envelope.data?.accessToken;
    if (typeof accessToken !== "string" || !accessToken) return null;

    setToken(accessToken);
    return accessToken;
  } catch {
    return null;
  }
}

/** 用 refresh token 换取新的 access token；并发 401 时共用一个进行中的请求 */
async function tryRefreshAccessToken(): Promise<string | null> {
  const refreshTokenValue = getRefreshToken();
  if (!refreshTokenValue) return null;

  if (!refreshInFlight) {
    refreshInFlight = requestNewAccessToken(refreshTokenValue).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** 供 auth.refreshToken 等显式调用 */
export async function refreshAccessToken(): Promise<string> {
  const accessToken = await tryRefreshAccessToken();
  if (!accessToken) throw new Error("刷新登录态失败，请重新登录");
  return accessToken;
}

export class ApiError extends Error {
  readonly code: string | number;
  readonly status: number;
  readonly detail?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail?.trim() || body.message || String(body.code));
    this.name = "ApiError";
    this.code = body.code;
    this.status = status;
    this.detail = body.detail;
  }
}

function readableDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return undefined;
  const parts = detail
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const entry = item as { loc?: unknown[]; msg?: unknown };
      const msg = typeof entry.msg === "string" ? entry.msg : "";
      const loc = Array.isArray(entry.loc)
        ? entry.loc.filter((part) => part !== "body").join(".")
        : "";
      if (!msg) return "";
      return loc ? `${loc}: ${msg}` : msg;
    })
    .filter(Boolean);
  return parts.length ? parts.join("; ") : undefined;
}

function redirectOnUnauthorized(path: string) {
  if (typeof window === "undefined") return;
  const publicPath = window.location.pathname === "/login" || window.location.pathname === "/register";
  if (publicPath) return;
  const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.assign(`/login?redirect=${redirect || encodeURIComponent(path)}`);
}

type ResponseEnvelope = {
  data?: unknown;
  error?: ApiErrorBody | null;
  code?: string | number;
  message?: string;
  detail?: unknown;
};

function isUnauthorized(status: number, envelope: ResponseEnvelope): boolean {
  if (status === 401) return true;
  if ("code" in envelope && "message" in envelope) {
    const numericCode = typeof envelope.code === "number" ? envelope.code : Number(envelope.code);
    return numericCode === 401;
  }
  return false;
}

function throwUnauthorized(status: number, body: ApiErrorBody, path: string): never {
  clearToken();
  redirectOnUnauthorized(path);
  throw new ApiError(status, body);
}

async function handleUnauthorized<T>(
  path: string,
  init: RequestInit,
  authRetried: boolean,
  status: number,
  body: ApiErrorBody
): Promise<T | undefined> {
  if (!authRetried && !isAuthPath(path) && getRefreshToken()) {
    const newToken = await tryRefreshAccessToken();
    if (newToken) return apiRequestWithRetry<T>(path, init, true);
  }
  return throwUnauthorized(status, body, path);
}

/** 兼容 `{ data, error }` 与 `{ code, message, data }`；成功返回 `data`；204 无体返回 `undefined` */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T | undefined> {
  return apiRequestWithRetry<T>(path, init, false);
}

async function apiRequestWithRetry<T>(
  path: string,
  init: RequestInit,
  authRetried: boolean
): Promise<T | undefined> {
  const url = `${baseUrl()}${normalizePath(path)}`;
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.set("X-Guest-Session-Id", getGuestSessionId());
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 204) {
    return undefined;
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, { code: "PARSE_ERROR", message: "响应不是合法 JSON" });
  }

  const envelope = json as ResponseEnvelope;

  if (envelope.error) {
    if (isUnauthorized(res.status, envelope)) {
      return handleUnauthorized<T>(path, init, authRetried, res.status, envelope.error);
    }
    throw new ApiError(res.status, envelope.error);
  }

  if ("code" in envelope && "message" in envelope) {
    const numericCode = typeof envelope.code === "number" ? envelope.code : Number(envelope.code);
    if (!res.ok || numericCode >= 400) {
      if (isUnauthorized(res.status, envelope)) {
        return handleUnauthorized<T>(path, init, authRetried, res.status, {
          code: envelope.code ?? res.status,
          message: envelope.message ?? "请求失败",
          detail: readableDetail(envelope.detail)
        });
      }
      throw new ApiError(res.status, {
        code: envelope.code ?? res.status,
        message: envelope.message ?? "请求失败",
        detail: readableDetail(envelope.detail)
      });
    }
    return envelope.data as T;
  }

  if (!res.ok) {
    if (isUnauthorized(res.status, envelope)) {
      return handleUnauthorized<T>(path, init, authRetried, res.status, {
        code: "HTTP_ERROR",
        message: readableDetail(envelope.detail) || `请求失败 (${res.status})`,
        detail: readableDetail(envelope.detail)
      });
    }
    const detail = readableDetail(envelope.detail);
    throw new ApiError(res.status, {
      code: "HTTP_ERROR",
      message: detail || `请求失败 (${res.status})`,
      detail
    });
  }

  return envelope.data as T;
}
