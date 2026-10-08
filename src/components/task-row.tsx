import { Check, Trash2 } from "lucide-react";
import { priorityStyles, useTaskMutations, type Task } from "@/lib/data";
import { dueLabel } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export function TaskRow({ task, compact }: { task: Task; compact?: boolean }) {
  const { update, remove } = useTaskMutations();
  const p = priorityStyles[task.priority] ?? priorityStyles["medium"]!;
  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-line/25">
      <span className={cn("h-9 w-1 shrink-0 rounded-full", task.done ? "bg-line" : p.bar)} />
      <button
        aria-label={task.done ? "Mark as not done" : "Mark as done"}
        onClick={() => update.mutate({ id: task.id, done: !task.done })}
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md outline-1 -outline-offset-1 outline-line transition-colors",
          task.done && "bg-elec outline-elec",
        )}
      >
        {task.done && <Check className="size-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13px] font-medium", task.done && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {dueLabel(task.due_at)}
          {task.source !== "manual" && <span className="ml-2 text-cyan/80">· from {task.source}</span>}
        </p>
      </div>
      <span
        className={cn(
          "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider outline-1 -outline-offset-1",
          p.text,
          p.ring,
        )}
      >
        {p.label}
      </span>
      {!compact && (
        <button
          aria-label="Delete task"
          onClick={() => remove.mutate(task.id)}
          className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-rose focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
