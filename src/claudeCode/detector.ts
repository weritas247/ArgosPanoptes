import { ProcessInfo } from "../types";

export function isClaudeProcess(comm: string): boolean {
  const basename = comm.split("/").pop() || "";
  return basename === "claude" || basename.startsWith("claude-");
}

export function findClaudePids(processes: ProcessInfo[]): number[] {
  return processes.filter((p) => isClaudeProcess(p.comm)).map((p) => p.pid);
}
