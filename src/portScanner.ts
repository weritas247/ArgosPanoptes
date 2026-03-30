import { execFile } from "child_process";

export function parseLsofOutput(output: string): Map<number, number[]> {
  const portMap = new Map<number, number[]>();
  if (!output.trim()) return portMap;
  const lines = output.trim().split("\n").slice(1);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parseInt(parts[1], 10);
    // NAME field may be followed by a state like "(LISTEN)"; find the address token
    const addressField = parts.find((p) => p.includes(":")) || "";
    const portMatch = addressField.match(/:(\d+)$/);
    if (!portMatch) continue;
    const port = parseInt(portMatch[1], 10);
    const existing = portMap.get(pid) || [];
    if (!existing.includes(port)) existing.push(port);
    portMap.set(pid, existing);
  }
  return portMap;
}

export function scanPorts(): Promise<Map<number, number[]>> {
  return new Promise((resolve, reject) => {
    execFile("lsof", ["-iTCP", "-sTCP:LISTEN", "-P", "-n"], (error, stdout) => {
      if (error) { if (error.code === 1) { resolve(new Map()); return; } reject(error); return; }
      resolve(parseLsofOutput(stdout));
    });
  });
}
