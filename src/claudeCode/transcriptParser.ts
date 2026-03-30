import * as fs from "fs";
import { SubagentInfo } from "../types";

export interface TranscriptSummary {
  model: string | undefined;
  inputTokens: number;
  outputTokens: number;
  subagents: SubagentInfo[];
}

export function parseTranscript(filePath: string): TranscriptSummary {
  const result: TranscriptSummary = { model: undefined, inputTokens: 0, outputTokens: 0, subagents: [] };
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.model && !result.model) result.model = entry.model;
      if (entry.usage) {
        result.inputTokens += entry.usage.input_tokens || 0;
        result.outputTokens += entry.usage.output_tokens || 0;
      }
      if (entry.type === "tool_use" && entry.tool === "Agent") {
        result.subagents.push({
          type: entry.subagent_type || "unknown",
          description: entry.description || "",
          pid: undefined,
          status: "completed",
        });
      }
    }
  } catch {}
  return result;
}

export function estimateCost(model: string | undefined, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-opus-4-6": { input: 15, output: 75 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  };
  const rates = pricing[model || ""] || pricing["claude-sonnet-4-6"];
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}
