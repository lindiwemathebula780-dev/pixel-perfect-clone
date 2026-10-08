import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [{ title: "Assistant — Nexora" }, { name: "description", content: "Chat with your AI productivity assistant." }] }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data: latest } = await supabase.from("threads").select("id").order("updated_at", { ascending: false }).limit(1);
      let id = latest?.[0]?.id;
      if (!id) {
        const { data, error } = await supabase.from("threads").insert({}).select("id").single();
        if (error) {
          toast.error(error.message);
          return;
        }
        id = data.id;
      }
      navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
    })();
  }, [navigate]);
  return <p className="eyebrow p-10 text-center animate-pulse">Opening assistant</p>;
}
