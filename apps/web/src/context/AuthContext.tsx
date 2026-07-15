import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { decodeUserId } from "../hooks/useLiveAccount";
import { AUTH_TOKEN_KEY, AUTH_USERNAME_KEY } from "../lib/constants";

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
  signup: (name: string, username: string, password: string) => Promise<{ token: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(AUTH_TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => window.localStorage.getItem(AUTH_USERNAME_KEY));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<AuthMode>("login");

  const openAuthModal = (mode: AuthMode) => {
    setModalMode(mode);
    setModalOpen(true);
  };
  const closeAuthModal = () => setModalOpen(false);

  function applyAuth(nextToken: string, nextUsername: string) {
    setToken(nextToken);
    setUsername(nextUsername);
    window.localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
    window.localStorage.setItem(AUTH_USERNAME_KEY, nextUsername);
    setModalOpen(false);
  }

  async function login(loginUsername: string, password: string) {
    const response = await api.signin({ username: loginUsername, password });
    applyAuth(response.token, loginUsername);
  }

  async function signup(name: string, signupUsername: string, password: string) {
    const response = await api.signup({ name, username: signupUsername, password });
    applyAuth(response.token, signupUsername);
    return response;
  }

  function logout() {
    setToken(null);
    setUsername(null);
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USERNAME_KEY);
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
