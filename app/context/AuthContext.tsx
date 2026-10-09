"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/libs/api";

// Define the shape of our User object based on your backend structure
interface User {
  id: number;
  userId: string;
  email: string;
  name: string;
  role: string;
  profilePictureUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check if a user is already logged in on initial mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.get("/auth/profile");
        setUser(response.data);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      setUser(response.data); // Set user in state
      router.push("/dashboard"); // Redirect to protected route
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // Throw to handle errors in the UI component
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
      setUser(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("trainxcel_selected_course");
        sessionStorage.removeItem("trainxcel_selected_lesson");
        sessionStorage.removeItem("trainxcel_course_details_tab");
      }
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const reloadProfile = async () => {
    try {
      const response = await api.get("/auth/profile");
      setUser(response.data);
    } catch (error) {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to easily use the auth context in any component
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}