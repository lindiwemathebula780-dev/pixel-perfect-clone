import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, CheckSquare, LayoutGrid, LogOut, Mail, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";
import mark from "@/assets/nexora-mark.png";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/chat", label: "Assistant", icon: MessageSquare },
  { to: "/emails", label: "Emails", icon: Mail },
  { to: "/tasks", label: "Planner", icon: CheckSquare },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
] as const;

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const navigate = useNavigate();
  const name = displayName(user);
  return (
    <div className="grid-bg min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-void/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 md:px-8 md:py-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-elec/15 outline-1 -outline-offset-1 outline-elec/40">
              <img src={mark} alt="" className="size-6" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-semibold tracking-tight">Nexora</p>
              <p className="hidden text-[11px] text-muted-foreground sm:block">AI productivity workspace</p>
            </div>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 text-[13px] font-medium md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "chip-active outline-1 -outline-offset-1" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[12px] font-medium text-foreground/80">{name}</p>
              <p className="text-[11px] text-muted-foreground">{user.email}</p>
            </div>
            <div className="brand-orb size-9 rounded-full outline-1 -outline-offset-1 outline-foreground/10" />
            <button
              aria-label="Sign out"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="rounded-md p-2 text-muted-foreground hover:bg-line/50 hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      {children}
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-void/95 backdrop-blur-md md:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground"
            activeProps={{ className: "text-elec-glow" }}
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-1">{eyebrow}</p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-[34px]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
