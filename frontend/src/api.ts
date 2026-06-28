import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const TOKEN_KEY = "shiftly_token";

export async function saveToken(token: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") return window.localStorage.getItem(TOKEN_KEY);
    return null;
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function api(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err: any = new Error(json?.detail || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export function wsUrl(matchId: string, token: string) {
  const base = (BASE || "").replace(/^http/, "ws");
  return `${base}/api/ws/chat/${matchId}?token=${encodeURIComponent(token)}`;
}

export const BACKEND_URL = BASE;
