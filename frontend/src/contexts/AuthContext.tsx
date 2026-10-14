import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  auth,
  getToken,
  setToken,
  removeToken,
  type ApiUser,
  ApiError,
} from "@/lib/api";

// ── Normalised user shape used throughout the frontend ──
export interface User {
  id: string;
  name: string;
  email: string;
  role: "citizen" | "department" | "municipal";
  city: string;         // city name
  cityId: string;       // city UUID
  department?: string;  // department name (dept users only)
  departmentId?: string;
  avatar?: string | null;
  createdAt: string;
}

function normalizeUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role,
    city: apiUser.city?.name ?? "",
    cityId: apiUser.city?.id ?? apiUser.cityId ?? "",
    department: apiUser.department?.name ?? undefined,
    departmentId: apiUser.department?.id ?? apiUser.departmentId ?? undefined,
    avatar: apiUser.avatar,
    createdAt: apiUser.createdAt,
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  quickAdminLogin: (targetCity?: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    city: string,
    otp: string,
    password?: string
  ) => Promise<{ success: boolean; error?: string }>;
  sendSignupOtp: (
    name: string,
    email: string,
    city: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: if a token exists, fetch the current user
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    auth
      .me()
      .then((res) => {
        setUser(normalizeUser(res.user));
      })
      .catch(() => {
        // Token is invalid or expired
        removeToken();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await auth.login(email, password);
        setToken(res.token);
        setUser(normalizeUser(res.user));
        return { success: true };
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Login failed. Please try again.";
        return { success: false, error: msg };
      }
    },
    []
  );

  const loginWithOtp = useCallback(
    async (email: string, otp: string) => {
      try {
        const res = await auth.loginWithOtp(email, otp);
        setToken(res.token);
        setUser(normalizeUser(res.user));
        return { success: true };
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "OTP login failed. Please try again.";
        return { success: false, error: msg };
      }
    },
    []
  );

  const quickAdminLogin = useCallback(
    async (targetCity?: string) => {
      try {
        const res = await auth.quickAdminLogin(targetCity);
        setToken(res.token);
        setUser(normalizeUser(res.user));
        return { success: true };
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Admin login failed. Please try again.";
        return { success: false, error: msg };
      }
    },
    []
  );

  const sendSignupOtp = useCallback(
    async (name: string, email: string, city: string) => {
      try {
        await auth.sendSignupOtp(name, email, city);
        return { success: true };
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to send verification code. Please try again.";
        return { success: false, error: msg };
      }
    },
    []
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      city: string,
      otp: string,
      password?: string
    ) => {
      try {
        const res = await auth.register(name, email, city, otp, password);
        setToken(res.token);
        setUser(normalizeUser(res.user));
        return { success: true };
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Registration failed. Please try again.";
        return { success: false, error: msg };
      }
    },
    []
  );

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        loginWithOtp,
        quickAdminLogin,
        register,
        sendSignupOtp,
        logout,
      }}
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
