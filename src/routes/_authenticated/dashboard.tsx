import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, isToday } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Copy } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useEmails, useTasks, useThreads } from "@/lib/data";
import { scheduleTone, tasksOn, weekDays } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexora" },
      { name: "description", content: "Your day at a glance: tasks, emails, schedule and AI assistant." },
      { property: "og:title", content: "Dashboard — Nexora" },
      { property: "og:description", content: "Your day at a glance in Nexora." },
    ],
  }),
  component: Dashboard,
});

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

function Dashboard() {
  const tasks = useTasks();
  const emails = useEmails();
  const threads = useThreads();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [range, setRange] = useState<"day" | "week">("week");

  const open = (tasks.data ?? []).filter((t) => !t.done);
  const dueToday = open.filter((t) => t.due_at && isToday(new Date(t.due_at))).length;
  const latest = emails.data?.[0];
  const days = range === "week" ? weekDays() : [new Date()];

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return undefined;
    const { data, error } = await supabase.from("threads").insert({}).select("id").single();
    if (error) { toast.error(error.message); return undefined; }
    navigate({ to: "/chat/$threadId", params: { threadId: data.id }, search: { q: q.trim() } });
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader eyebrow={format(new Date(), "EEEE · MMMM d")} title={`${greeting()}.`}>
        {(["day", "week"] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={cn("chip bg-panel", range === r && "chip-active")}>
            {r === "day" ? "Daily" : "Weekly"}
          </button>
        ))}
      </PageHeader>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="panel flex flex-col lg:col-span-5">
          <div className="panel-head">
            <p className="panel-title">AI Assistant</p>
            <span className="flex items-center gap-1.5 text-[11px] text-cyan">
              <span className="size-1.5 rounded-full bg-cyan" />
              online
            </span>
          </div>
          <div className="flex-1 space-y-3 px-5 py-5 text-[13px]">
            <p className="text-muted-foreground">Try a command:</p>
            {[
              "Plan my week around my deadlines",
              "Draft a friendly follow-up to the design team",
              "Remind me to send the invoice by Friday 5pm",
            ].map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="block w-full rounded-xl rounded-tl-sm bg-line/40 px-4 py-2.5 text-left text-foreground/85 outline-1 -outline-offset-1 outline-line/70 transition-colors hover:bg-line/70"
              >
                {s}
              </button>
            ))}
            {!!threads.data?.length && (
              <div className="pt-2">
                <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">Recent</p>
                {threads.data.slice(0, 3).map((t) => (
                  <Link
                    key={t.id}
                    to="/chat/$threadId"
                    params={{ threadId: t.id }}
                    className="block truncate py-1 text-foreground/70 hover:text-cyan"
                  >
                    {t.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={ask} className="flex items-center gap-2 border-t border-line/70 px-4 py-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Ask Nexora"
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 outline-none"
              placeholder="Ask Nexora anything…"
            />
            <Button size="sm" type="submit">
              Send
            </Button>
          </form>
        </section>

        <section className="panel lg:col-span-7">
          <div className="panel-head">
            <p className="panel-title">Smart Email Generator</p>
            <Link to="/emails" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cyan">
              Open <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="px-5 py-5">
            {emails.isLoading ? (
              <Skeleton className="h-28" />
            ) : latest ? (
              <>
                <div className="mb-4 flex gap-2">
                  {["formal", "friendly", "persuasive"].map((t) => (
                    <span key={t} className={cn("chip capitalize", latest.tone === t && "chip-cyan")}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="rounded-lg bg-void px-4 py-3 text-[13px] outline-1 -outline-offset-1 outline-line/70">
                  <p className="mb-1 font-medium">{latest.subject}</p>
                  <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">{latest.body}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground capitalize">
                    Tone · {latest.tone} · {latest.body.split(/\s+/).filter(Boolean).length} words
                  </span>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/emails" search={{ id: latest.id }}>Edit</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="cyan"
                      onClick={() => {
                        navigator.clipboard.writeText(`Subject: ${latest.subject}\n\n${latest.body}`);
                        toast.success("Email copied");
                      }}
                    >
                      <Copy className="size-3.5" /> Copy
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-[13px] text-muted-foreground">
                No drafts yet.{" "}
                <Link to="/emails" className="text-cyan">
                  Write your first email
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="panel lg:col-span-5">
          <div className="panel-head">
            <p className="panel-title">AI Task Planner</p>
            <span className="text-[11px] text-muted-foreground">
              {open.length} open · {dueToday} due today
            </span>
          </div>
          <div className="px-2 py-2">
            {tasks.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : open.length ? (
              open.slice(0, 5).map((t) => <TaskRow key={t.id} task={t} compact />)
            ) : (
              <p className="py-8 text-center text-[13px] text-muted-foreground">
                All clear.{" "}
                <Link to="/tasks" className="text-cyan">
                  Add a task
                </Link>
              </p>
            )}
            {open.length > 5 && (
              <Link to="/tasks" className="block px-3 py-2 text-[12px] text-muted-foreground hover:text-cyan">
                View all {open.length} tasks →
              </Link>
            )}
          </div>
        </section>

        <section className="panel lg:col-span-7">
          <div className="panel-head">
            <p className="panel-title">{range === "week" ? "Weekly Schedule" : "Today's Schedule"}</p>
            <Link to="/schedule" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cyan">
              {range === "week" ? "Mon – Fri" : format(new Date(), "EEE MMM d")} <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className={cn("grid gap-2 p-4", range === "week" ? "grid-cols-5" : "grid-cols-1")}>
            {days.map((d) => {
              const items = tasksOn(open, d);
              return (
                <div key={d.toISOString()} className="min-w-0 space-y-2">
                  <p
                    className={cn(
                      "text-center text-[11px] font-semibold uppercase tracking-wider",
                      isToday(d) ? "text-cyan" : "text-muted-foreground",
                    )}
                  >
                    {format(d, "EEE")}
                  </p>
                  {items.length ? (
                    items.slice(0, 4).map((t) => (
                      <div
                        key={t.id}
                        className={cn("rounded-md px-2 py-2 outline-1 -outline-offset-1", scheduleTone[t.priority])}
                      >
                        <p className="truncate text-[11px] font-medium">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(t.scheduled_at!), "HH:mm")}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md px-2 py-3 text-center text-[10px] text-muted-foreground/60 outline-1 -outline-offset-1 outline-dashed outline-line/60">
                      Free
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
