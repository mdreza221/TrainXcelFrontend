import { useAuth } from "@/context/AuthContext";

export function useUser() {
  const { user } = useAuth();
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    userId: user?.userId ?? "",
    role: user?.role ?? "",
    profilePictureUrl: user?.profilePictureUrl ?? "",
  };
}
