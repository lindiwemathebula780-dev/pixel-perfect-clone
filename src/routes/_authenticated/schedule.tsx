import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/lib/data";
import { planSchedule } from "@/lib/ai.functions";
import { scheduleTone, tasksOn, weekDays } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — Nexora" },
      { name: "description", content: "AI-generated daily and weekly schedules built around your deadlines." },
      { property: "og:title", content: "Schedule — Nexora" },
      { property: "og:description", content: "Daily and weekly AI schedules." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const tasks = useTasks();
  const qc = useQueryClient();
  const plan = useServerFn(planSchedule);
  const [range, setRange] = useState<"day" | "week">("week");
  const [view, setView] = useState<"calendar" | "timeline">("calendar");
  const [busy, setBusy] = useState(false);
  const open = (tasks.data ?? []).filter((t) => !t.done);
  const days = range === "week" ? weekDays() : [new Date()];
  const unscheduled = open.filter((t) => !t.scheduled_at);

  async function generate() {
    setBusy(true);
    try {
      const r = await plan({ data: { now: new Date().toISOString(), range, tzOffsetMinutes: new Date().getTimezoneOffset() } });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`Scheduled ${r.scheduled} tasks`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader eyebrow="Schedule" title={range === "week" ? "This week" : format(new Date(), "EEEE, MMMM d")}>
        {(["day", "week"] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={cn("chip bg-panel", range === r && "chip-active")}>
            {r === "day" ? "Daily" : "Weekly"}
          </button>
        ))}
        {(["calendar", "timeline"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn("chip bg-panel capitalize", view === v && "chip-cyan")}>
            {v}
          </button>
        ))}
        <Button onClick={generate} disabled={busy}>
          <CalendarClock className="size-4" /> {busy ? "Planning…" : `Generate ${range === "day" ? "daily" : "weekly"} plan`}
        </Button>
      </PageHeader>

      {view === "calendar" ? (
        <div className={cn("panel mt-6 grid gap-2 p-4", range === "week" ? "grid-cols-1 sm:grid-cols-5" : "grid-cols-1")}>
          {days.map((d) => (
            <div key={d.toISOString()} className="space-y-2">
              <p className={cn("text-center text-[11px] font-semibold uppercase tracking-wider", isToday(d) ? "text-cyan" : "text-muted-foreground")}>
                {format(d, "EEE d")}
              </p>
              {tasksOn(open, d).map((t) => (
                <div key={t.id} className={cn("rounded-md px-2.5 py-2 outline-1 -outline-offset-1", scheduleTone[t.priority])}>
                  <p className="text-[12px] font-medium">{t.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(t.scheduled_at!), "HH:mm")} · {t.duration_minutes}m
                  </p>
                </div>
              ))}
              {!tasksOn(open, d).length && (
                <div className="rounded-md py-6 text-center text-[11px] text-muted-foreground/60 outline-1 -outline-offset-1 outline-dashed outline-line/60">Free</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="panel mt-6 p-5">
          {days.map((d) => (
            <div key={d.toISOString()} className="mb-5 last:mb-0">
              <p className="eyebrow mb-2">{format(d, "EEEE · MMM d")}</p>
              <ol className="relative space-y-3 border-l border-line pl-5">
                {tasksOn(open, d).map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-elec" />
                    <p className="text-[13px] font-medium">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(t.scheduled_at!), "HH:mm")} · {t.duration_minutes} min · {t.priority}
                    </p>
                  </li>
                ))}
                {!tasksOn(open, d).length && <li className="text-[12px] text-muted-foreground">Nothing scheduled</li>}
              </ol>
            </div>
          ))}
        </div>
      )}

      {!!unscheduled.length && (
        <p className="mt-4 text-[12px] text-muted-foreground">
          {unscheduled.length} open task{unscheduled.length > 1 ? "s" : ""} not yet scheduled — generate a plan to slot them in.
        </p>
      )}
    </main>
  );
}
