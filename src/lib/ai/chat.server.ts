import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { getGateway, RESPONSES_OPTIONS } from "./model.server";
import { getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./run-id.server";

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });

export async function handleChat(request: Request) {
  const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = (await request.json()) as { messages?: UIMessage[]; threadId?: string; now?: string };
  const parsed = z
    .object({ threadId: z.string().uuid(), messages: z.array(z.any()).min(1) })
    .safeParse(body);
  if (!parsed.success) return json(400, "Invalid request");
  const messages = body.messages as UIMessage[];
  const threadId = parsed.data.threadId;

  const { data: thread } = await supabase.from("threads").select("id,title").eq("id", threadId).maybeSingle();
  if (!thread) return json(404, "Conversation not found");

  const now = body.now ?? new Date().toISOString();

  const tools = {
    createTask: tool({
      description: "Create a task in the user's planner.",
      inputSchema: z.object({
        title: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        due_at: z.string().nullable().describe("ISO 8601 deadline or null"),
        duration_minutes: z.number().int().nullable(),
        notes: z.string().nullable(),
      }),
      execute: async (t) => {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ title: t.title, priority: t.priority, notes: t.notes, due_at: t.due_at || null, duration_minutes: t.duration_minutes || 60, source: "chat" })
          .select("id,title,priority,due_at")
          .single();
        if (error) throw new Error(error.message);
        return data;
      },
    }),
    listTasks: tool({
      description: "List the user's open tasks with priorities, deadlines and scheduled times.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from("tasks")
          .select("id,title,priority,due_at,scheduled_at,done")
          .eq("done", false)
          .limit(50);
        if (error) throw new Error(error.message);
        return data;
      },
    }),
    completeTask: tool({
      description: "Mark a task done by id (call listTasks first to find the id).",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const { data, error } = await supabase.from("tasks").update({ done: true }).eq("id", id).select("id,title").single();
        if (error) throw new Error(error.message);
        return data;
      },
    }),
    draftEmail: tool({
      description: "Write an email and save it as a draft in the Email Generator. Write the full subject and body yourself.",
      inputSchema: z.object({
        tone: z.enum(["formal", "friendly", "persuasive"]),
        recipient: z.string().nullable(),
        subject: z.string(),
        body: z.string().describe("Plain text body with greeting and sign-off"),
        instructions: z.string().describe("Short summary of what the email is for"),
      }),
      execute: async (e) => {
        const { data, error } = await supabase
          .from("emails")
          .insert({ ...e })
          .select("id,subject,body,tone,recipient")
          .single();
        if (error) throw new Error(error.message);
        return data;
      },
    }),
  };

  const gw = getGateway(getLovableAiGatewayRunId(request));
  const result = streamText({
    model: gw.model(),
    providerOptions: RESPONSES_OPTIONS,
    abortSignal: request.signal,
    instructions: `You are Nexora, a sharp, friendly AI productivity assistant inside a workspace with a Task Planner, Email Generator and Schedule. Current time: ${now}.
- When the user asks to remember, do, plan or follow up on something, create tasks with createTask (choose sensible priority and deadline).
- When asked to write/draft/reply to an email, use draftEmail, then show a short summary and mention it's saved in Emails.
- When the user pastes an email or notes, offer or create the actionable tasks found in it.
- Use listTasks before answering questions about their workload. Be concise; use markdown lists.`,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(50),
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    generateMessageId: () => crypto.randomUUID(),
    onFinish: async ({ messages: all }) => {
      const rows = all.map((m) => ({
        thread_id: threadId,
        ui_id: m.id,
        role: m.role,
        message: m as unknown as Database["public"]["Tables"]["messages"]["Insert"]["message"],
      }));
      const { error } = await supabase.from("messages").upsert(rows, { onConflict: "thread_id,ui_id" });
      if (error) console.error("Failed to save messages", error);
      const firstUser = all.find((m) => m.role === "user");
      const firstText = firstUser?.parts.find((p) => p.type === "text") as { text?: string } | undefined;
      const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
      if (thread.title === "New conversation" && firstText?.text) patch.title = firstText.text.slice(0, 60);
      const { error: tErr } = await supabase.from("threads").update(patch).eq("id", threadId);
      if (tErr) console.error("Failed to update thread", tErr);
    },
  });
  return withLovableAiGatewayRunIdHeader(response, gw);
}
