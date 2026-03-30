import * as fs from "fs";
import { ClaudePrompt } from "../types";

interface HistoryEntry {
  type: string;
  message: string;
  timestamp: string;
  sessionId: string;
}

export function parseHistoryFile(filePath: string): HistoryEntry[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.trim().split("\n").filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.type === "human");
  } catch { return []; }
}

export function getPromptsForSession(entries: HistoryEntry[], sessionId: string): ClaudePrompt[] {
  return entries.filter((e) => e.sessionId === sessionId)
    .map((e) => ({ text: e.message, timestamp: e.timestamp, status: "completed" as const }));
}

export function getHistoryPath(): string {
  const home = process.env.HOME || "/Users/unknown";
  return `${home}/.claude/history.jsonl`;
}
