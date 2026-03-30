import { ProcessInfo, TerminalInfo, TerminatedProcess } from "./types";

export class ProcessHistory {
  private entries: TerminatedProcess[] = [];
  private previousPids = new Map<number, { comm: string; terminalName: string }>();
  private terminalShellPid: number;
  private maxEntries: number;

  constructor(terminalShellPid: number, maxEntries = 200) {
    this.terminalShellPid = terminalShellPid;
    this.maxEntries = maxEntries;
  }

  update(terminals: TerminalInfo[], allProcesses: ProcessInfo[]): void {
    const currentPids = new Map<number, { comm: string; terminalName: string }>();
    for (const proc of allProcesses) {
      const terminal = terminals.find((t) => t.shellPid !== undefined);
      const terminalName = terminal?.name ?? "unknown";
      currentPids.set(proc.pid, { comm: proc.comm, terminalName });
    }
    for (const [pid, info] of this.previousPids) {
      if (!currentPids.has(pid)) {
        this.entries.push({ pid, comm: info.comm, exitCode: undefined, terminatedAt: new Date().toISOString(), terminalName: info.terminalName });
      }
    }
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    this.previousPids = currentPids;
  }

  getAll(): TerminatedProcess[] {
    return [...this.entries].reverse();
  }
}
