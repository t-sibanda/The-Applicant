import { trpc } from "@/lib/trpc";

export function useAuth() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  return {
    user: me.data ?? null,
    isAuthenticated: !!me.data,
    isAdmin: me.data?.role === "admin",
    isLoading: me.isLoading,
    refetch: me.refetch,
  };
}
