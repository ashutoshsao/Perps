import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { decodeUserId } from "../hooks/useLiveAccount";
import { clearSession, getAccessToken, getRefreshToken, getUsername, setSession, subscribe } from "../api/session";

type AuthMode = "login" | "signup";

type AuthContextValue = {
  token: string | null;
  username: string | null;
  userId: string | null;
  modalOpen: boolean;
  modalMode: AuthMode;
  openAuthModal: (mode: AuthMode) => void;
  closeAuthModal: () => void;
  login: (username: string, password: string) => Promise<void>;
  signup: (name: string, username: string, password: string) => Promise<{ token: string; refreshToken: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [username, setUsername] = useState<string | null>(() => getUsername());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<AuthMode>("login");

  // picks up token refreshes from client.ts's silent-refresh, which runs
  // outside React and updates the session store directly
  useEffect(() => subscribe(() => {
    setToken(getAccessToken());
    setUsername(getUsername());
  }), []);

  const openAuthModal = (mode: AuthMode) => {
    setModalMode(mode);
    setModalOpen(true);
  };
  const closeAuthModal = () => setModalOpen(false);

  function applyAuth(nextToken: string, nextRefreshToken: string, nextUsername: string) {
    setSession(nextToken, nextRefreshToken, nextUsername);
    setToken(nextToken);
    setUsername(nextUsername);
    setModalOpen(false);
  }

  async function login(loginUsername: string, password: string) {
    const response = await api.signin({ username: loginUsername, password });
    applyAuth(response.token, response.refreshToken, loginUsername);
  }

  async function signup(name: string, signupUsername: string, password: string) {
    const response = await api.signup({ name, username: signupUsername, password });
    applyAuth(response.token, response.refreshToken, signupUsername);
    return response;
  }

  function logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) api.logout(refreshToken).catch(() => { });
    clearSession();
    setToken(null);
    setUsername(null);
  }

  const userId = useMemo(() => decodeUserId(token), [token]);

  return (
    <AuthContext.Provider
      value={{ token, username, userId, modalOpen, modalMode, openAuthModal, closeAuthModal, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
