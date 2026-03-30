export interface ProcessInfo {
  pid: number;
  ppid: number;
  cpu: number;
  mem: number;
  elapsed: string;
  stat: string;
  comm: string;
  children: ProcessInfo[];
  ports: number[];
}

export interface TerminalInfo {
  id: number;
  name: string;
  shellPid: number | undefined;
  tag: string | undefined;
  processes: ProcessInfo[];
}

export interface ClaudeSession {
  sessionId: string;
  pid: number;
  workingDirectory: string;
  startTime: string;
  model: string | undefined;
  prompts: ClaudePrompt[];
  subagents: SubagentInfo[];
  worktreePath: string | undefined;
  worktreeBranch: string | undefined;
}

export interface ClaudePrompt {
  text: string;
  timestamp: string;
  status: "in_progress" | "completed";
}

export interface SubagentInfo {
  type: string;
  description: string;
  pid: number | undefined;
  status: string;
}

export interface TerminatedProcess {
  pid: number;
  comm: string;
  exitCode: number | undefined;
  terminatedAt: string;
  terminalName: string;
}

export interface DashboardData {
  terminals: TerminalInfo[];
  claudeSessions: ClaudeSession[];
  history: TerminatedProcess[];
  lastUpdated: string;
}

export type WebviewMessage =
  | { command: "kill"; pid: number }
  | { command: "focusTerminal"; terminalId: number }
  | { command: "openPort"; port: number }
  | { command: "setTag"; terminalId: number; tag: string }
  | { command: "refresh" };
