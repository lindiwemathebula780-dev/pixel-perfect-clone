import { createLovableAiGatewayProvider } from "./gateway.server";

export const AI_MODEL = "google/gemini-3-flash-preview";
export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

export function getGateway(runId?: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured");
  return createLovableAiGatewayProvider(key, runId, { baseURL: GATEWAY_URL });
}

export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
