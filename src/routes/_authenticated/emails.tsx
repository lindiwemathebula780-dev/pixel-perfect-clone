import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, ListPlus, RefreshCw, Save, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useEmails, useTaskMutations } from "@/lib/data";
import { extractTasks, generateEmail } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/emails")({
  validateSearch: z.object({ id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Smart Email Generator — Nexora" },
      { name: "description", content: "Generate formal, friendly or persuasive emails with AI, then edit, refine and copy." },
      { property: "og:title", content: "Smart Email Generator — Nexora" },
      { property: "og:description", content: "AI emails in any tone." },
    ],
  }),
  component: EmailsPage,
});

type Tone = "formal" | "friendly" | "persuasive";

function EmailsPage() {
  const { id } = Route.useSearch();
  const emails = useEmails();
  const qc = useQueryClient();
  const gen = useServerFn(generateEmail);
  const extract = useServerFn(extractTasks);
  const { create } = useTaskMutations();
  const [currentId, setCurrentId] = useState<string | null>(id ?? null);
  const [instructions, setInstructions] = useState("");
  const [recipient, setRecipient] = useState("");
  const [tone, setTone] = useState<Tone>("formal");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [refine, setRefine] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    const e = emails.data?.find((x) => x.id === currentId);
    if (e) {
      setInstructions(e.instructions);
      setRecipient(e.recipient ?? "");
      setTone(e.tone as Tone);
      setSubject(e.subject);
      setBody(e.body);
    }
  }, [currentId, emails.data]);

  async function save(s = subject, b = body) {
    const row = { instructions, recipient: recipient || null, tone, subject: s, body: b, updated_at: new Date().toISOString() };
    if (currentId) {
      const { error } = await supabase.from("emails").update(row).eq("id", currentId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("emails").insert(row).select("id").single();
      if (error) throw error;
      setCurrentId(data.id);
    }
    await qc.invalidateQueries({ queryKey: ["emails"] });
  }

  async function run(kind: "gen" | "refine") {
    if (!instructions.trim()) { toast.error("Describe what the email should say"); return; }
    setBusy(kind);
    try {
      const r = await gen({
        data: {
          instructions,
          tone,
          ...(recipient ? { recipient } : {}),
          ...(kind === "refine" && body ? { previous: `Subject: ${subject}\n\n${body}`, refinement: refine } : {}),
        },
      });
      setSubject(r.subject);
      setBody(r.body);
      setRefine("");
      await save(r.subject, r.body);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function toTasks() {
    setBusy("tasks");
    try {
      const found = await extract({ data: { text: `${subject}\n\n${body}`, now: new Date().toISOString() } });
      if (!found.length) { toast.info("No action items found"); return; }
      await create.mutateAsync(
        found.map((t) => ({
          title: t.title,
          priority: t.priority,
          due_at: t.due_at && !isNaN(Date.parse(t.due_at)) ? new Date(t.due_at).toISOString() : null,
          source: "email",
        })),
      );
      toast.success(`Added ${found.length} tasks to your planner`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setCurrentId(null);
    setInstructions("");
    setRecipient("");
    setSubject("");
    setBody("");
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader eyebrow="Smart Email Generator" title="Write it in seconds">
        <Button variant="secondary" onClick={reset}>New email</Button>
      </PageHeader>
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <section className="panel space-y-4 p-5 lg:col-span-5">
          <p className="panel-title">Instructions</p>
          <Input aria-label="Recipient" placeholder="Recipient (optional)" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          <Textarea
            aria-label="Instructions"
            rows={6}
            placeholder="e.g. Follow up with Priya about the pilot proposal; propose a call Thursday"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <div className="flex gap-2">
            {(["formal", "friendly", "persuasive"] as const).map((t) => (
              <button key={t} onClick={() => setTone(t)} className={cn("chip capitalize", tone === t && "chip-cyan")}>
                {t}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={() => run("gen")} disabled={!!busy}>
            <Wand2 className="size-4" /> {busy === "gen" ? "Writing…" : "Generate email"}
          </Button>
          {!!emails.data?.length && (
            <div className="border-t border-line/70 pt-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Saved drafts</p>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {emails.data.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setCurrentId(e.id)}
                    className={cn("block w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-line/40", currentId === e.id && "bg-line/50 text-cyan")}
                  >
                    {e.subject || "Untitled"} <span className="text-[11px] capitalize text-muted-foreground">· {e.tone}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="panel flex flex-col lg:col-span-7">
          <div className="panel-head">
            <p className="panel-title">Draft</p>
            <span className="text-[11px] capitalize text-muted-foreground">
              Tone · {tone} · {body.split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
          <div className="flex-1 space-y-3 p-5">
            {busy === "gen" || busy === "refine" ? (
              <div className="space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-line" />
                <div className="h-32 animate-pulse rounded bg-line/60" />
              </div>
            ) : (
              <>
                <Input aria-label="Subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <Textarea aria-label="Body" rows={12} className="bg-void" placeholder="Your email will appear here — edit freely." value={body} onChange={(e) => setBody(e.target.value)} />
              </>
            )}
            <div className="flex gap-2">
              <Input aria-label="Refinement" placeholder="Refine: make it shorter, add a deadline…" value={refine} onChange={(e) => setRefine(e.target.value)} />
              <Button variant="secondary" onClick={() => run("refine")} disabled={!!busy || !body || !refine}>Refine</Button>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line/70 px-5 py-3">
            <Button variant="secondary" size="sm" onClick={toTasks} disabled={!!busy || !body}>
              <ListPlus className="size-3.5" /> {busy === "tasks" ? "Extracting…" : "Create tasks"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => run("gen")} disabled={!!busy || !instructions}>
              <RefreshCw className="size-3.5" /> Regenerate
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!body}
              onClick={() => save().then(() => toast.success("Draft saved"), (e: Error) => toast.error(e.message))}
            >
              <Save className="size-3.5" /> Save
            </Button>
            <Button
              variant="cyan"
              size="sm"
              disabled={!body}
              onClick={() => {
                navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
                toast.success("Email copied");
              }}
            >
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
