import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { apiGet, apiPost, setToken, clearToken, getToken } from "@/src/api";

type User = { user_id: string; email: string; name: string; picture: string } | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

const AUTH_BASE = "https://auth.emergentagent.com/";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await apiGet("/auth/me", true);
      setUser(me);
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  const processSessionId = useCallback(async (sessionId: string) => {
    const data = await apiPost("/auth/session", { session_id: sessionId });
    await setToken(data.session_token);
    setUser(data.user);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          const hash = window.location.hash || "";
          const search = window.location.search || "";
          let sid: string | null = null;
          if (hash.includes("session_id=")) sid = hash.split("session_id=")[1].split("&")[0];
          else if (search.includes("session_id=")) sid = new URLSearchParams(search).get("session_id");
          if (sid) {
            await processSessionId(sid);
            window.history.replaceState(null, "", window.location.pathname);
            setLoading(false);
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          if (initial && initial.includes("session_id=")) {
            const sid = initial.split("session_id=")[1].split("&")[0];
            await processSessionId(sid);
            setLoading(false);
            return;
          }
        }
        await loadMe();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMe, processSessionId]);

  const login = useCallback(async () => {
    if (Platform.OS === "web") {
      const redirect = window.location.origin + "/";
      window.location.href = `${AUTH_BASE}?redirect=${encodeURIComponent(redirect)}`;
      return;
    }
    const redirectUrl = Linking.createURL("auth");
    const authUrl = `${AUTH_BASE}?redirect=${encodeURIComponent(redirectUrl)}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url.includes("session_id=")) {
      const sid = result.url.split("session_id=")[1].split("&")[0];
      await processSessionId(sid);
    }
  }, [processSessionId]);

  const logout = useCallback(async () => {
    try {
      await apiPost("/auth/logout", {}, true);
    } catch {}
    await clearToken();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
