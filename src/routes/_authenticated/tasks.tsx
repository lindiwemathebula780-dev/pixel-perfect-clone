import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskMutations, useTasks, type Priority } from "@/lib/data";
import { extractTasks, prioritizeTasks } from "@/lib/ai.functions";
import { fromLocalInput } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Task Planner — Nexora" },
      { name: "description", content: "Create, prioritize and manage tasks and deadlines with AI." },
      { property: "og:title", content: "Task Planner — Nexora" },
      { property: "og:description", content: "AI task planning with priorities and deadlines." },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const tasks = useTasks();
  const { create } = useTaskMutations();
  const qc = useQueryClient();
  const prioritize = useServerFn(prioritizeTasks);
  const extract = useServerFn(extractTasks);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [due, setDue] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "prio" | "extract">("");
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");

  const list = (tasks.data ?? []).filter((t) => (filter === "all" ? true : filter === "done" ? t.done : !t.done));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({ title: title.trim(), priority, due_at: fromLocalInput(due) });
    setTitle("");
    setDue("");
    toast.success("Task added");
  }

  async function autoPrioritize() {
    setBusy("prio");
    try {
      const r = await prioritize({ data: { now: new Date().toISOString() } });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`Re-prioritized ${r.updated} tasks`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function fromText() {
    if (!text.trim()) return;
    setBusy("extract");
    try {
      const found = await extract({ data: { text, now: new Date().toISOString() } });
      if (!found.length) {
        toast.info("No tasks found in that text");
        return;
      }
      await create.mutateAsync(
        found.map((t) => ({
          title: t.title,
          priority: t.priority,
          due_at: t.due_at && !isNaN(Date.parse(t.due_at)) ? new Date(t.due_at).toISOString() : null,
          duration_minutes: t.duration_minutes ?? 60,
          source: "email",
        })),
      );
      setText("");
      toast.success(`Added ${found.length} tasks`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader eyebrow="AI Task Planner" title="Tasks & deadlines">
        <Button onClick={autoPrioritize} disabled={!!busy}>
          <Wand2 className="size-4" /> {busy === "prio" ? "Prioritizing…" : "Auto-prioritize"}
        </Button>
      </PageHeader>
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-4">
          <form onSubmit={add} className="panel space-y-3 p-5">
            <p className="panel-title">New task</p>
            <Input aria-label="Task title" placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="flex gap-2">
              {(["high", "medium", "low"] as const).map((p) => (
                <button type="button" key={p} onClick={() => setPriority(p)} className={cn("chip capitalize", priority === p && "chip-active")}>
                  {p}
                </button>
              ))}
            </div>
            <Input aria-label="Deadline" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            <Button type="submit" className="w-full" disabled={create.isPending}>Add task</Button>
          </form>
          <div className="panel space-y-3 p-5">
            <p className="panel-title">Turn text into tasks</p>
            <Textarea
              aria-label="Email or notes"
              rows={6}
              placeholder="Paste an email, meeting notes or a brain-dump…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button variant="cyan" className="w-full" onClick={fromText} disabled={!!busy || !text.trim()}>
              {busy === "extract" ? "Extracting…" : "Extract tasks with AI"}
            </Button>
          </div>
        </div>
        <section className="panel lg:col-span-8">
          <div className="panel-head">
            <p className="panel-title">Prioritized list</p>
            <div className="flex gap-1.5">
              {(["open", "done", "all"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("chip capitalize", filter === f && "chip-active")}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="p-2">
            {tasks.isLoading ? (
              <div className="space-y-2 p-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : tasks.isError ? (
              <p className="p-6 text-center text-sm text-rose">Couldn't load tasks.</p>
            ) : list.length ? (
              list.map((t) => <TaskRow key={t.id} task={t} />)
            ) : (
              <p className="p-10 text-center text-sm text-muted-foreground">Nothing here yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
