import { execFile } from "child_process";
import { ProcessInfo } from "./types";

export function parsePsOutput(output: string): ProcessInfo[] {
  const lines = output.trim().split("\n");
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const parts = line.trim().split(/\s+/);
    return {
      pid: parseInt(parts[0], 10), ppid: parseInt(parts[1], 10),
      cpu: parseFloat(parts[2]), mem: parseFloat(parts[3]),
      elapsed: parts[4], stat: parts[5], comm: parts.slice(6).join(" "),
      children: [], ports: [],
    };
  });
}

export function buildProcessTree(processes: ProcessInfo[], rootPid: number): ProcessInfo[] {
  const byPpid = new Map<number, ProcessInfo[]>();
  for (const proc of processes) {
    const list = byPpid.get(proc.ppid) || [];
    list.push(proc);
    byPpid.set(proc.ppid, list);
  }
  function attachChildren(pid: number): ProcessInfo[] {
    return (byPpid.get(pid) || []).map((child) => ({ ...child, children: attachChildren(child.pid) }));
  }
  return attachChildren(rootPid);
}

export function scanProcesses(): Promise<ProcessInfo[]> {
  return new Promise((resolve, reject) => {
    execFile("ps", ["-eo", "pid,ppid,%cpu,%mem,etime,stat,comm"], (error, stdout) => {
      if (error) { reject(error); return; }
      resolve(parsePsOutput(stdout));
    });
  });
}
