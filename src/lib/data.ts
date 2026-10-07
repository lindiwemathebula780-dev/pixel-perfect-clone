import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Email = Database["public"]["Tables"]["emails"]["Row"];
export type Thread = Database["public"]["Tables"]["threads"]["Row"];
export type Priority = "high" | "medium" | "low";

export const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const p = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
    if (p) return p;
    const ad = a.due_at ? +new Date(a.due_at) : Infinity;
    const bd = b.due_at ? +new Date(b.due_at) : Infinity;
    return ad - bd;
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return sortTasks(data);
    },
  });
}

export function useEmails() {
  return useQuery({
    queryKey: ["emails"],
    queryFn: async () => {
      const { data, error } = await supabase.from("emails").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useThreads() {
  return useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("threads").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export function useTaskMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const onError = (e: Error) => toast.error(e.message || "Something went wrong");
  const create = useMutation({
    mutationFn: async (t: TaskInsert | TaskInsert[]) => {
      const { error } = await supabase.from("tasks").insert(t);
      if (error) throw error;
    },
    onSuccess: done,
    onError,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: TaskUpdate & { id: string }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: done,
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: done,
    onError,
  });
  return { create, update, remove };
}

export const priorityStyles: Record<string, { bar: string; text: string; ring: string; label: string }> = {
  high: { bar: "bg-rose", text: "text-rose", ring: "outline-rose/40", label: "High" },
  medium: { bar: "bg-amber", text: "text-amber", ring: "outline-amber/40", label: "Med" },
  low: { bar: "bg-lime", text: "text-lime", ring: "outline-lime/40", label: "Low" },
};
