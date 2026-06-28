import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { api, getToken, saveToken, clearToken } from "../api";

function readSessionIdFromUrl(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const hash = window.location.hash || "";
    if (hash.includes("session_id=")) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const sid = params.get("session_id");
      if (sid) return sid;
    }
    const search = window.location.search || "";
    if (search.includes("session_id=")) {
      const params = new URLSearchParams(search.replace(/^\?/, ""));
      const sid = params.get("session_id");
      if (sid) return sid;
    }
  } catch {}
  return null;
}

function cleanUrl() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {}
}

type User = {
  user_id: string;
  email?: string | null;
  phone?: string | null;
  name: string;
  picture?: string | null;
  role?: "student" | "shop_owner" | null;
  has_profile: boolean;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setToken: (t: string, u: User) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  loading: true,
  refresh: async () => {},
  setToken: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Web Google OAuth: detect session_id in URL hash/query and process it FIRST.
    const sid = readSessionIdFromUrl();
    if (sid) {
      try {
        const data = await api("/auth/google/session", {
          method: "POST",
          body: JSON.stringify({ session_id: sid }),
        });
        await saveToken(data.token);
        cleanUrl();
        setUser(data.user);
        setLoading(false);
        return;
      } catch {
        cleanUrl();
        // fall through to existing-token check
      }
    }
    const tok = await getToken();
    if (!tok) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api("/auth/me");
      setUser(data.user);
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setToken = async (t: string, u: User) => {
    await saveToken(t);
    setUser(u);
  };

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await clearToken();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, refresh, setToken, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
