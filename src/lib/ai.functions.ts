import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function db() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient<import("@/integrations/supabase/types").Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function runText(system: string, prompt: string) {
  const { streamText } = await import("ai");
  const { getGateway, RESPONSES_OPTIONS } = await import("./ai/model.server");
  const gw = getGateway();
  const result = streamText({ model: gw.model(), instructions: system, prompt, providerOptions: RESPONSES_OPTIONS });
  return await result.text;
}

async function runJson<T>(system: string, prompt: string): Promise<T> {
  const { extractJson } = await import("./ai/model.server");
  const text = await runText(system + "\nRespond with valid JSON only, no commentary.", prompt);
  return extractJson<T>(text);
}

const emailSchema = z.object({
  instructions: z.string().min(1).max(4000),
  tone: z.enum(["formal", "friendly", "persuasive"]),
  recipient: z.string().max(200).optional(),
  previous: z.string().max(8000).optional(),
  refinement: z.string().max(1000).optional(),
});

export const generateEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => emailSchema.parse(d))
  .handler(async ({ data }) => {
    const prompt = [
      `Instructions: ${data.instructions}`,
      data.recipient ? `Recipient: ${data.recipient}` : "",
      `Tone: ${data.tone}`,
      data.previous ? `Current draft:\n${data.previous}` : "",
      data.refinement ? `Refine the current draft: ${data.refinement}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const out = await runJson<{ subject: string; body: string }>(
      `You write excellent professional emails. Tones: formal = polished and precise; friendly = warm and conversational; persuasive = confident, benefit-led with a clear call to action. Return {"subject": string, "body": string}. Body is plain text with greeting and sign-off, no markdown.`,
      prompt,
    );
    return { subject: String(out.subject ?? ""), body: String(out.body ?? "") };
  });

const taskOut = z.array(
  z.object({
    title: z.string(),
    priority: z.enum(["high", "medium", "low"]).catch("medium"),
    due_at: z.string().nullable().optional(),
    duration_minutes: z.number().int().positive().catch(60).optional(),
  }),
);

export const extractTasks = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ text: z.string().min(1).max(10000), now: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const out = await runJson<unknown>(
      `Extract concrete, actionable tasks from the text. Return an array of {"title","priority":"high|medium|low","due_at": ISO 8601 or null,"duration_minutes": number}. Current time: ${data.now}. Max 8 tasks.`,
      data.text,
    );
    return taskOut.parse(out);
  });

export const prioritizeTasks = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ now: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const context = { supabase: await db() };
    const { data: tasks, error } = await context.supabase
      .from("tasks")
      .select("id,title,notes,priority,due_at,duration_minutes")
      .eq("done", false);
    if (error) throw new Error(error.message);
    if (!tasks.length) return { updated: 0 };
    const out = await runJson<{ id: string; priority: string }[]>(
      `You are a productivity coach. Assign each task a priority (high|medium|low) based on urgency (deadline vs now: ${data.now}) and impact. Return an array of {"id","priority"} for every task.`,
      JSON.stringify(tasks),
    );
    let updated = 0;
    for (const t of out) {
      if (!["high", "medium", "low"].includes(t.priority) || !tasks.find((x) => x.id === t.id)) continue;
      const { error: e } = await context.supabase.from("tasks").update({ priority: t.priority }).eq("id", t.id);
      if (!e) updated++;
    }
    return { updated };
  });

export const planSchedule = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ now: z.string(), range: z.enum(["day", "week"]), tzOffsetMinutes: z.number() }).parse(d),
  )
  .handler(async ({ data }) => {
    const context = { supabase: await db() };
    const { data: tasks, error } = await context.supabase
      .from("tasks")
      .select("id,title,priority,due_at,duration_minutes")
      .eq("done", false);
    if (error) throw new Error(error.message);
    if (!tasks.length) return { scheduled: 0 };
    const out = await runJson<{ id: string; scheduled_at: string }[]>(
      `You plan a realistic ${data.range === "day" ? "schedule for today" : "weekly schedule for the next 5 working days"}. Current time (ISO): ${data.now}. The user's UTC offset is ${-data.tzOffsetMinutes} minutes. Working hours 09:00–18:00 local, weekdays only, no overlaps, high priority and earlier deadlines first, keep a lunch break 12:30–13:30, schedule before deadlines. ${data.range === "day" ? "Only schedule what fits today; skip the rest." : ""} Return an array of {"id","scheduled_at": ISO 8601 with offset}.`,
      JSON.stringify(tasks),
    );
    let scheduled = 0;
    for (const s of out) {
      if (!tasks.find((x) => x.id === s.id) || isNaN(Date.parse(s.scheduled_at))) continue;
      const { error: e } = await context.supabase
        .from("tasks")
        .update({ scheduled_at: new Date(s.scheduled_at).toISOString() })
        .eq("id", s.id);
      if (!e) scheduled++;
    }
    return { scheduled };
  });
