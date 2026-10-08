import { createOpenAI } from "@ai-sdk/openai";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

export const AI_MODEL = "openai/gpt-6-astra";
export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

export const RESPONSES_OPTIONS = {
  openai: {
    store: false,
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    include: ["reasoning.encrypted_content"],
  },
};

export function getGateway(runId?: string) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured");
  const runIdFetch = createLovableAiGatewayRunIdFetch(runId);
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return {
    model: () => provider.responses(AI_MODEL),
    getRunId: runIdFetch.getRunId,
    waitForRunId: runIdFetch.waitForRunId,
  };
}

export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
