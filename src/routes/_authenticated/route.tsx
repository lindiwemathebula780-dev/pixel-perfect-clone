import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="grid-bg grid min-h-screen place-items-center">
        <p className="eyebrow animate-pulse">Loading workspace</p>
      </div>
    );
  }
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}
