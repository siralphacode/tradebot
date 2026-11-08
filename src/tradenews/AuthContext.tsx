import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authMe, BackendUser } from "./api.ts";

interface AuthState {
  token: string | null;
  user: BackendUser | null;
  authChecked: boolean;
  authAvailable: boolean;
  authError: string | null;
  signIn: (token: string, user: BackendUser, remember: boolean) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function readToken(): string | null {
  try {
    return (
      localStorage.getItem("tradenews_auth_token") ||
      sessionStorage.getItem("tradenews_auth_token")
    );
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<BackendUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authAvailable, setAuthAvailable] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const t = readToken();
    if (!t) {
      setToken(null);
      setUser(null);
      setAuthChecked(true);
      return;
    }
    setToken(t);
    const res = await authMe();
    if (res.ok) {
      setUser(res.data as BackendUser);
      setAuthAvailable(true);
      setAuthError(null);
    } else {
      const failure = res as unknown as { endpointDisabled?: boolean; status?: number; message?: string; kind?: string };
      // Missing/disabled auth endpoint: keep "signed out" but flag unavailable.
      setAuthAvailable(!(failure.endpointDisabled || failure.status === 0));
      if (failure.kind === "unauthorized") {
        try {
          localStorage.removeItem("tradenews_auth_token");
          sessionStorage.removeItem("tradenews_auth_token");
        } catch {}
        setToken(null);
        setUser(null);
      }
      setAuthError(failure.message || "Authentication unavailable.");
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback((nextToken: string, nextUser: BackendUser, remember: boolean) => {
    try {
      if (remember) {
        localStorage.setItem("tradenews_auth_token", nextToken);
        sessionStorage.removeItem("tradenews_auth_token");
      } else {
        sessionStorage.setItem("tradenews_auth_token", nextToken);
        localStorage.removeItem("tradenews_auth_token");
      }
    } catch {}
    setToken(nextToken);
    setUser(nextUser);
    setAuthChecked(true);
    setAuthAvailable(true);
    setAuthError(null);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem("tradenews_auth_token");
      sessionStorage.removeItem("tradenews_auth_token");
    } catch {}
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ token, user, authChecked, authAvailable, authError, signIn, signOut, refresh }),
    [token, user, authChecked, authAvailable, authError, signIn, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
