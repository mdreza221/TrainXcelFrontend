"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If we finished loading and there is no user, kick them to login
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  // Show a loading state while checking the cookie
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  // If user exists, render the protected content
  if (user) {
    return <>{children}</>;
  }

  return null;
}