import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Plus } from "lucide-react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useThreads } from "@/lib/data";
import { cn } from "@/lib/utils";
import mark from "@/assets/nexora-mark.png";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({ meta: [{ title: "Assistant — Nexora" }, { name: "description", content: "Chat with your AI productivity assistant." }] }),
  component: ChatPage,
});

const TOOL_LABELS: Record<string, string> = {
  "tool-createTask": "Created task",
  "tool-listTasks": "Checked your tasks",
  "tool-completeTask": "Completed task",
  "tool-draftEmail": "Drafted email",
};

function ChatPage() {
  const { threadId } = Route.useParams();
  const threads = useThreads();
  const navigate = useNavigate();
  const history = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("message").eq("thread_id", threadId).order("created_at");
      if (error) throw error;
      return data.map((r) => r.message as unknown as UIMessage);
    },
  });

  async function newThread() {
    const { data, error } = await supabase.from("threads").insert({}).select("id").single();
    if (error) return toast.error(error.message);
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  return (
    <main className="mx-auto grid max-w-[1440px] gap-5 px-4 py-6 md:px-8 lg:grid-cols-[240px_1fr]">
      <aside className="panel hidden h-[calc(100vh-130px)] flex-col lg:flex">
        <div className="panel-head">
          <p className="panel-title">Conversations</p>
          <Button size="icon-sm" variant="ghost" aria-label="New conversation" onClick={newThread}>
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {threads.data?.map((t) => (
            <Link
              key={t.id}
              to="/chat/$threadId"
              params={{ threadId: t.id }}
              className={cn("block truncate rounded-md px-3 py-2 text-[13px] text-muted-foreground hover:bg-line/40", t.id === threadId && "bg-line/60 text-foreground")}
            >
              {t.title}
            </Link>
          ))}
        </div>
      </aside>
      <section className="panel flex h-[calc(100vh-170px)] flex-col md:h-[calc(100vh-130px)]">
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <img src={mark} alt="" className="size-5" />
            <p className="panel-title">Nexora Assistant</p>
          </div>
          <Button size="sm" variant="secondary" className="lg:hidden" onClick={newThread}>
            <Plus className="size-3.5" /> New
          </Button>
        </div>
        {history.isLoading ? (
          <p className="eyebrow flex-1 p-10 text-center animate-pulse">Loading</p>
        ) : (
          <ChatWindow key={threadId} threadId={threadId} initial={history.data ?? []} />
        )}
      </section>
    </main>
  );
}

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const qc = useQueryClient();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const sentQ = useRef(false);
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat", body: () => ({ threadId, now: new Date().toISOString() }) }),
    onError: (e) => toast.error(e.message.includes("429") ? "Too many requests — try again shortly" : e.message.includes("402") ? "AI credits exhausted" : "The assistant couldn't respond. Please try again."),
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (q && !sentQ.current) {
      sentQ.current = true;
      sendMessage({ text: q });
      navigate({ to: "/chat/$threadId", params: { threadId }, search: {}, replace: true });
    }
  }, [q, sendMessage, navigate, threadId]);

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent>
          {!messages.length && (
            <ConversationEmptyState
              icon={<img src={mark} alt="" className="size-12" />}
              title="How can I help today?"
              description="Ask me to plan your week, draft an email, or turn notes into tasks."
            />
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((p, i) => {
                  if (p.type === "text") return <MessageResponse key={i}>{p.text}</MessageResponse>;
                  if (p.type.startsWith("tool-")) {
                    const tp = p as Extract<typeof p, { type: `tool-${string}` }> & { state: never; input: unknown; output: unknown; errorText?: string };
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader type={tp.type as never} state={tp.state} title={TOOL_LABELS[tp.type] ?? tp.type} />
                        <ToolContent>
                          <ToolInput input={tp.input as never} />
                          <ToolOutput output={tp.output as never} errorText={tp.errorText as never} />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer>Thinking…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-line/70 p-3">
        <PromptInput
          onSubmit={({ text }) => {
            if (!text.trim() || busy) return;
            sendMessage({ text });
          }}
        >
          <PromptInputTextarea autoFocus placeholder="Ask Nexora anything…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}
