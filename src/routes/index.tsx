import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckSquare, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexora — AI chat, emails and task planning in one workspace" },
      {
        name: "description",
        content: "Chat with an AI assistant, generate emails in any tone, and auto-plan your tasks into daily and weekly schedules.",
      },
      { property: "og:title", content: "Nexora — your AI productivity workspace" },
      {
        property: "og:description",
        content: "One assistant for chat, emails, tasks and your schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: MessageSquare, title: "AI Assistant", text: "Ask anything. It creates tasks and drafts emails right from the chat." },
  { icon: Mail, title: "Smart Emails", text: "Formal, friendly or persuasive — edit, refine, copy, regenerate." },
  { icon: CheckSquare, title: "Task Planner", text: "Priorities and deadlines, auto-prioritized by AI." },
  { icon: CalendarDays, title: "Schedule", text: "Daily and weekly plans built around your deadlines." },
];

function Landing() {

  return (
    <main className="grid-bg min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col items-start px-6 py-24 md:py-32">
        <p className="eyebrow mb-4">AI productivity workspace</p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          One assistant for your chats, emails and <span className="text-cyan">entire week.</span>
        </h1>
        <p className="mt-6 max-w-xl text-muted-foreground">
          Nexora turns conversations into tasks, tasks into a schedule, and instructions into ready-to-send emails.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/dashboard">Open your workspace</Link>
        </Button>
        <div className="mt-16 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel p-5">
              <f.icon className="mb-3 size-5 text-cyan" />
              <p className="panel-title">{f.title}</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
