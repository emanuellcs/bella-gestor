"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "@/types";
import { AppRole } from "@/types";
import { supabase } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Verify existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserWithRole(session.user.id, session.user.email || "");
      }
    });

    // Listen for authentication changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserWithRole(session.user.id, session.user.email || "");
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserWithRole = async (userId: string, email: string) => {
    try {
      // Fetch user role from user_roles table
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      const userRole =
        (roleData as { role: AppRole })?.role || AppRole.SECRETARY;

      const appUser: User = {
        id: userId,
        name: email.split("@")[0] || "Usuário",
        email: email,
        role: userRole,
      };
      setUser(appUser);
      setIsAuthenticated(true);
    } catch (err) {
      console.error("Error loading user role:", err);
      // Fallback to Secretary if an error occurs
      const appUser: User = {
        id: userId,
        name: email.split("@")[0] || "Usuário",
        email: email,
        role: AppRole.SECRETARY,
      };
      setUser(appUser);
      setIsAuthenticated(true);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error.message);
        return false;
      }

      if (data.user) {
        await loadUserWithRole(data.user.id, data.user.email || "");
        return true;
      }

      return false;
    } catch (err) {
      console.error("Login exception:", err);
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
