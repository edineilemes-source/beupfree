import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Credentials = { email: string; password: string };
type Registration = Credentials & { name: string };

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (input: Registration) => Promise<void>;
  login: (input: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body?.message === "string" ? body.message : fallback;
  } catch {
    return fallback;
  }
}

async function authRequest(path: string, init?: RequestInit) {
  return fetch(path, { ...init, credentials: "include" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authRequest("/api/auth/me");
      if (response.status === 401) {
        setUser(null);
        return;
      }
      if (!response.ok) throw new Error("Não foi possível verificar sua sessão.");
      const body = (await response.json()) as { user: AuthUser };
      setUser(body.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser().catch(() => setUser(null));
  }, [refreshUser]);

  const register = useCallback(async (input: Registration) => {
    const response = await authRequest("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(await readError(response, "Não foi possível criar sua conta."));
    }
    const body = (await response.json()) as { user: AuthUser };
    setUser(body.user);
  }, []);

  const login = useCallback(async (input: Credentials) => {
    const response = await authRequest("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const message = response.status === 401
        ? "E-mail ou senha inválidos."
        : await readError(response, "Não foi possível entrar agora.");
      throw new Error(message);
    }
    const body = (await response.json()) as { user: AuthUser };
    setUser(body.user);
  }, []);

  const logout = useCallback(async () => {
    const response = await authRequest("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Não foi possível sair agora.");
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null,
    isLoading,
    register,
    login,
    logout,
    refreshUser,
  }), [user, isLoading, register, login, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
