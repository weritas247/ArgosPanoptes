import * as vscode from "vscode";
import { SidebarProvider } from "./sidebar/sidebarProvider";
import { TerminalTracker } from "./terminalTracker";
import { scanProcesses, buildProcessTree } from "./processScanner";
import { scanPorts } from "./portScanner";
import { ProcessHistory } from "./processHistory";
import { findClaudePids } from "./claudeCode/detector";
import { findSessionByPid, getSessionsDir } from "./claudeCode/sessionParser";
import { parseHistoryFile, getPromptsForSession, getHistoryPath } from "./claudeCode/historyParser";
import { parseTranscript, estimateCost } from "./claudeCode/transcriptParser";
import { DashboardData, ClaudeSession, WebviewMessage } from "./types";
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";

const REFRESH_INTERVAL = 5000;

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  const terminalTracker = new TerminalTracker(context);
  const processHistory = new ProcessHistory(0);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  sidebarProvider.setMessageHandler((message: WebviewMessage) => {
    handleMessage(message, terminalTracker);
  });

  let refreshTimer: NodeJS.Timeout | undefined;

  async function refresh() {
    try {
      const data = await collectData(terminalTracker, processHistory);
      sidebarProvider.updateData(data);
    } catch (err) {
      console.error("Argos Panoptes refresh error:", err);
    }
  }

  refreshTimer = setInterval(refresh, REFRESH_INTERVAL);
  refresh();

  context.subscriptions.push({
    dispose() {
      if (refreshTimer) clearInterval(refreshTimer);
      terminalTracker.dispose();
    },
  });
}

async function collectData(
  terminalTracker: TerminalTracker,
  processHistory: ProcessHistory
): Promise<DashboardData> {
  const terminals = await terminalTracker.getTerminals();
  const [allProcesses, portMap] = await Promise.all([scanProcesses(), scanPorts()]);

  // Assign ports to processes
  for (const proc of allProcesses) {
    proc.ports = portMap.get(proc.pid) || [];
  }

  // Build process trees per terminal
  for (const terminal of terminals) {
    if (terminal.shellPid !== undefined) {
      terminal.processes = buildProcessTree(allProcesses, terminal.shellPid);
    }
  }

  // Update history
  processHistory.update(terminals, allProcesses);

  // Detect Claude Code sessions
  const claudePids = findClaudePids(allProcesses);
  const sessionsDir = getSessionsDir();
  const historyEntries = parseHistoryFile(getHistoryPath());
  const claudeSessions: ClaudeSession[] = [];

  for (const pid of claudePids) {
    const session = findSessionByPid(sessionsDir, pid);
    if (session) {
      // Enrich with prompts
      session.prompts = getPromptsForSession(historyEntries, session.sessionId);

      // Try to find transcript for token/model info
      const transcriptDir = path.join(process.env.HOME || "", ".claude", "transcripts");
      if (fs.existsSync(transcriptDir)) {
        const files = fs.readdirSync(transcriptDir).filter((f) => f.endsWith(".jsonl"));
        for (const file of files) {
          const filePath = path.join(transcriptDir, file);
          const summary = parseTranscript(filePath);
          if (summary.model) {
            session.model = summary.model;
            (session as any).inputTokens = summary.inputTokens;
            (session as any).outputTokens = summary.outputTokens;
            (session as any).estimatedCost = estimateCost(
              summary.model, summary.inputTokens, summary.outputTokens
            );
            session.subagents = summary.subagents;
            break;
          }
        }
      }

      // Find which terminal this Claude session belongs to
      const terminal = terminals.find((t) => {
        if (t.shellPid === undefined) return false;
        return allProcesses.some(
          (p) => p.pid === pid && isDescendant(allProcesses, p.pid, t.shellPid!)
        );
      });
      if (terminal) {
        (session as any).terminalId = terminal.id;
      }

      // Detect worktree
      try {
        const cwd = await getProcessCwd(pid);
        if (cwd && cwd.includes(".git/worktrees")) {
          const parts = cwd.split("/");
          const wtIndex = parts.indexOf("worktrees");
          if (wtIndex >= 0) {
            session.worktreePath = cwd;
            session.worktreeBranch = parts[wtIndex + 1];
          }
        }
      } catch {
        // Worktree detection is best-effort
      }

      claudeSessions.push(session);
    }
  }

  // Sort Claude sessions: most recently started first
  claudeSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  return {
    terminals,
    claudeSessions,
    history: processHistory.getAll(),
    lastUpdated: new Date().toISOString(),
  };
}

function isDescendant(
  allProcesses: { pid: number; ppid: number }[],
  childPid: number,
  ancestorPid: number
): boolean {
  let current = childPid;
  const visited = new Set<number>();
  while (current !== 0 && !visited.has(current)) {
    visited.add(current);
    if (current === ancestorPid) return true;
    const proc = allProcesses.find((p) => p.pid === current);
    if (!proc) return false;
    current = proc.ppid;
  }
  return false;
}

function getProcessCwd(pid: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("lsof", ["-p", String(pid), "-Fn", "-a", "-d", "cwd"], (err, stdout) => {
      if (err) { reject(err); return; }
      const lines = stdout.split("\n");
      const cwdLine = lines.find((l) => l.startsWith("n"));
      resolve(cwdLine ? cwdLine.substring(1) : "");
    });
  });
}

function handleMessage(message: WebviewMessage, terminalTracker: TerminalTracker) {
  switch (message.command) {
    case "kill":
      process.kill(message.pid, "SIGTERM");
      break;
    case "focusTerminal":
      terminalTracker.focusTerminal(message.terminalId);
      break;
    case "openPort":
      vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${message.port}`));
      break;
    case "setTag":
      const terminals = vscode.window.terminals;
      if (terminals[message.terminalId]) {
        terminalTracker.setTag(terminals[message.terminalId].name, message.tag);
      }
      break;
    case "refresh":
      break;
  }
}

export function deactivate() {}
