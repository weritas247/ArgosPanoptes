import * as fs from "fs";
import * as path from "path";
import { ClaudeSession } from "../types";

interface RawSession {
  sessionId: string;
  cwd?: string;
  workingDirectory?: string;
  startedAt?: number;
  startTime?: string;
  kind?: string;
  entrypoint?: string;
}

export function parseSessionFile(filePath: string, pid: number): ClaudeSession {
  const raw: RawSession = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const startTime = raw.startedAt
    ? new Date(raw.startedAt).toISOString()
    : raw.startTime || "";
  return {
    sessionId: raw.sessionId,
    pid,
    workingDirectory: raw.cwd || raw.workingDirectory || "",
    startTime,
    model: undefined,
    prompts: [],
    subagents: [],
    worktreePath: undefined,
    worktreeBranch: undefined,
  };
}

export function findSessionByPid(sessionsDir: string, pid: number, overrideFilename?: string): ClaudeSession | undefined {
  try {
    const filename = overrideFilename ?? `${pid}.json`;
    const filePath = path.join(sessionsDir, filename);
    if (!fs.existsSync(filePath)) return undefined;
    return parseSessionFile(filePath, pid);
  } catch { return undefined; }
}

export function getSessionsDir(): string {
  const home = process.env.HOME || "/Users/unknown";
  return path.join(home, ".claude", "sessions");
}
