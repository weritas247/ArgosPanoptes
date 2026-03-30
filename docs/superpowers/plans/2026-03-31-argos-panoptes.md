# ArgosPanoptes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VSCode sidebar Webview extension that monitors terminal processes and Claude Code sessions on macOS.

**Architecture:** Extension host runs periodic `ps`/`lsof` scans, builds process trees per terminal, detects Claude Code sessions by reading `~/.claude/` state files. Data flows via `postMessage` to a sidebar Webview that renders process trees, Claude Code dashboards, and action controls.

**Tech Stack:** TypeScript, VSCode Extension API (Webview + Terminal), macOS `ps`/`lsof`, HTML/CSS/JS (Webview)

---

## File Structure

```
src/
├── extension.ts                    — Extension activation, registration
├── terminalTracker.ts              — Track open terminals, PIDs, tags
├── processScanner.ts               — Run ps, build process trees
├── portScanner.ts                  — Run lsof, map ports to PIDs
├── processHistory.ts               — Track terminated processes
├── claudeCode/
│   ├── detector.ts                 — Detect Claude Code processes
│   ├── sessionParser.ts            — Parse ~/.claude/sessions/ files
│   ├── historyParser.ts            — Parse ~/.claude/history.jsonl
│   └── transcriptParser.ts         — Parse transcripts for tokens/subagents
├── sidebar/
│   └── sidebarProvider.ts          — WebviewViewProvider implementation
├── types.ts                        — Shared type definitions
└── utils.ts                        — Nonce generation, helpers

media/
├── main.js                         — Webview entry point
├── style.css                       — Webview styles
└── icon.svg                        — Activity bar icon

test/
├── processScanner.test.ts
├── portScanner.test.ts
├── processHistory.test.ts
├── terminalTracker.test.ts
├── claudeCode/
│   ├── detector.test.ts
│   ├── sessionParser.test.ts
│   ├── historyParser.test.ts
│   └── transcriptParser.test.ts
└── fixtures/
    ├── ps-output.txt
    ├── lsof-output.txt
    ├── claude-session.json
    ├── claude-history.jsonl
    └── claude-transcript.jsonl
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `src/extension.ts`, `src/types.ts`, `src/utils.ts`, `.vscode/launch.json`

- [ ] **Step 1: Initialize npm and install dependencies**

```bash
cd /Users/redpug/Dev/ArgosPanoptes
npm init -y
npm install --save-dev typescript @types/vscode @types/node @types/mocha mocha ts-mocha @vscode/test-electron
```

- [ ] **Step 2: Configure package.json for VSCode extension**

Replace `package.json` content:

```json
{
  "name": "argos-panoptes",
  "displayName": "Argos Panoptes",
  "description": "Terminal process monitor and Claude Code session dashboard",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.93.0"
  },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./out/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "argos-panoptes",
          "title": "Argos Panoptes",
          "icon": "media/icon.svg"
        }
      ]
    },
    "views": {
      "argos-panoptes": [
        {
          "type": "webview",
          "id": "argosPanoptes.sidebar",
          "name": "Process Monitor"
        }
      ]
    }
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "ts-mocha test/**/*.test.ts"
  },
  "devDependencies": {}
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "out",
    "rootDir": ".",
    "lib": ["ES2022"],
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "out"]
}
```

- [ ] **Step 4: Create src/types.ts**

```typescript
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
```

- [ ] **Step 5: Create src/utils.ts**

```typescript
export function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

- [ ] **Step 6: Create src/extension.ts (minimal)**

```typescript
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("Argos Panoptes activated");
}

export function deactivate() {}
```

- [ ] **Step 7: Create .vscode/launch.json**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

- [ ] **Step 8: Create .vscode/tasks.json**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "watch",
      "problemMatcher": "$tsc-watch",
      "isBackground": true,
      "presentation": { "reveal": "never" },
      "group": { "kind": "build", "isDefault": true }
    }
  ]
}
```

- [ ] **Step 9: Create media/icon.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="3"/>
  <circle cx="12" cy="12" r="8" stroke-dasharray="4 2"/>
  <line x1="12" y1="2" x2="12" y2="4"/>
  <line x1="12" y1="20" x2="12" y2="22"/>
  <line x1="2" y1="12" x2="4" y2="12"/>
  <line x1="20" y1="12" x2="22" y2="12"/>
</svg>
```

- [ ] **Step 10: Update .gitignore**

Append to existing `.gitignore`:

```
out/
```

- [ ] **Step 11: Compile and verify**

```bash
npx tsc -p ./
```

Expected: compiles with no errors, `out/` directory created.

- [ ] **Step 12: Commit**

```bash
git add package.json tsconfig.json src/ media/ .vscode/ .gitignore
git commit -m "feat: scaffold VSCode extension project"
```

---

### Task 2: ProcessScanner — Parse `ps` Output Into Process Trees

**Files:**
- Create: `src/processScanner.ts`, `test/processScanner.test.ts`, `test/fixtures/ps-output.txt`

- [ ] **Step 1: Create test fixture**

Create `test/fixtures/ps-output.txt`:

```
  PID  PPID  %CPU %MEM     ELAPSED STAT COMM
50001     1   0.0  0.1    01:23:45 Ss   /bin/zsh
50010 50001   2.3  1.5       05:30 S+   node
50020 50010   0.5  0.8       05:29 Sl   /usr/bin/claude
50021 50020   0.1  0.2       04:00 Sl   node
50030 50001   0.0  0.0       00:10 S+   ls
60001     1   0.0  0.1    02:00:00 Ss   /bin/zsh
60010 60001   5.0  3.2       30:00 S+   python3
```

- [ ] **Step 2: Write failing tests**

Create `test/processScanner.test.ts`:

```typescript
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { parsePsOutput, buildProcessTree } from "../src/processScanner";

const fixtureDir = path.join(__dirname, "..", "test", "fixtures");

describe("ProcessScanner", () => {
  const psOutput = fs.readFileSync(
    path.join(fixtureDir, "ps-output.txt"),
    "utf-8"
  );

  describe("parsePsOutput", () => {
    it("should parse ps output into flat ProcessInfo list", () => {
      const processes = parsePsOutput(psOutput);
      assert.strictEqual(processes.length, 7);
      assert.strictEqual(processes[0].pid, 50001);
      assert.strictEqual(processes[0].ppid, 1);
      assert.strictEqual(processes[0].comm, "/bin/zsh");
      assert.strictEqual(processes[1].cpu, 2.3);
      assert.strictEqual(processes[1].mem, 1.5);
      assert.strictEqual(processes[1].elapsed, "05:30");
      assert.strictEqual(processes[1].stat, "S+");
    });

    it("should handle empty output", () => {
      const processes = parsePsOutput("  PID  PPID  %CPU %MEM     ELAPSED STAT COMM\n");
      assert.strictEqual(processes.length, 0);
    });
  });

  describe("buildProcessTree", () => {
    it("should build tree for a given root PID", () => {
      const processes = parsePsOutput(psOutput);
      const tree = buildProcessTree(processes, 50001);
      assert.strictEqual(tree.length, 2); // node and ls are direct children
      const nodeProc = tree.find((p) => p.comm === "node");
      assert.ok(nodeProc);
      assert.strictEqual(nodeProc!.children.length, 1); // claude is child of node
      assert.strictEqual(nodeProc!.children[0].comm, "/usr/bin/claude");
      assert.strictEqual(nodeProc!.children[0].children.length, 1); // node child of claude
    });

    it("should return empty array for PID with no children", () => {
      const processes = parsePsOutput(psOutput);
      const tree = buildProcessTree(processes, 99999);
      assert.strictEqual(tree.length, 0);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx ts-mocha test/processScanner.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement processScanner.ts**

```typescript
import { execFile } from "child_process";
import { ProcessInfo } from "./types";

export function parsePsOutput(output: string): ProcessInfo[] {
  const lines = output.trim().split("\n");
  if (lines.length <= 1) {
    return [];
  }

  return lines.slice(1).map((line) => {
    const parts = line.trim().split(/\s+/);
    return {
      pid: parseInt(parts[0], 10),
      ppid: parseInt(parts[1], 10),
      cpu: parseFloat(parts[2]),
      mem: parseFloat(parts[3]),
      elapsed: parts[4],
      stat: parts[5],
      comm: parts.slice(6).join(" "),
      children: [],
      ports: [],
    };
  });
}

export function buildProcessTree(
  processes: ProcessInfo[],
  rootPid: number
): ProcessInfo[] {
  const byPpid = new Map<number, ProcessInfo[]>();
  for (const proc of processes) {
    const list = byPpid.get(proc.ppid) || [];
    list.push(proc);
    byPpid.set(proc.ppid, list);
  }

  function attachChildren(pid: number): ProcessInfo[] {
    const children = byPpid.get(pid) || [];
    return children.map((child) => ({
      ...child,
      children: attachChildren(child.pid),
    }));
  }

  return attachChildren(rootPid);
}

export function scanProcesses(): Promise<ProcessInfo[]> {
  return new Promise((resolve, reject) => {
    execFile(
      "ps",
      ["-eo", "pid,ppid,%cpu,%mem,etime,stat,comm"],
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(parsePsOutput(stdout));
      }
    );
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx ts-mocha test/processScanner.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/processScanner.ts test/processScanner.test.ts test/fixtures/ps-output.txt
git commit -m "feat: process scanner with ps output parsing and tree building"
```

---

### Task 3: PortScanner — Parse `lsof` Output

**Files:**
- Create: `src/portScanner.ts`, `test/portScanner.test.ts`, `test/fixtures/lsof-output.txt`

- [ ] **Step 1: Create test fixture**

Create `test/fixtures/lsof-output.txt`:

```
COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    50010 redpug   22u  IPv4 0x1234      0t0  TCP *:3000 (LISTEN)
node    50010 redpug   23u  IPv4 0x1235      0t0  TCP *:3001 (LISTEN)
python3 60010 redpug   5u   IPv4 0x1236      0t0  TCP *:8080 (LISTEN)
```

- [ ] **Step 2: Write failing tests**

Create `test/portScanner.test.ts`:

```typescript
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { parseLsofOutput } from "../src/portScanner";

const fixtureDir = path.join(__dirname, "..", "test", "fixtures");

describe("PortScanner", () => {
  const lsofOutput = fs.readFileSync(
    path.join(fixtureDir, "lsof-output.txt"),
    "utf-8"
  );

  describe("parseLsofOutput", () => {
    it("should map PIDs to their listening ports", () => {
      const portMap = parseLsofOutput(lsofOutput);
      assert.deepStrictEqual(portMap.get(50010), [3000, 3001]);
      assert.deepStrictEqual(portMap.get(60010), [8080]);
    });

    it("should return empty map for empty output", () => {
      const portMap = parseLsofOutput("");
      assert.strictEqual(portMap.size, 0);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx ts-mocha test/portScanner.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement portScanner.ts**

```typescript
import { execFile } from "child_process";

export function parseLsofOutput(output: string): Map<number, number[]> {
  const portMap = new Map<number, number[]>();
  if (!output.trim()) {
    return portMap;
  }

  const lines = output.trim().split("\n").slice(1);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parseInt(parts[1], 10);
    const nameField = parts[parts.length - 1];
    // Format: *:PORT (LISTEN) — nameField is like "*:3000"
    const portMatch = nameField.match(/:(\d+)$/);
    if (!portMatch) {
      continue;
    }
    const port = parseInt(portMatch[1], 10);
    const existing = portMap.get(pid) || [];
    if (!existing.includes(port)) {
      existing.push(port);
    }
    portMap.set(pid, existing);
  }

  return portMap;
}

export function scanPorts(): Promise<Map<number, number[]>> {
  return new Promise((resolve, reject) => {
    execFile(
      "lsof",
      ["-iTCP", "-sTCP:LISTEN", "-P", "-n"],
      (error, stdout) => {
        if (error) {
          // lsof returns exit code 1 if no results
          if (error.code === 1) {
            resolve(new Map());
            return;
          }
          reject(error);
          return;
        }
        resolve(parseLsofOutput(stdout));
      }
    );
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx ts-mocha test/portScanner.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/portScanner.ts test/portScanner.test.ts test/fixtures/lsof-output.txt
git commit -m "feat: port scanner with lsof output parsing"
```

---

### Task 4: ProcessHistory — Track Terminated Processes

**Files:**
- Create: `src/processHistory.ts`, `test/processHistory.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/processHistory.test.ts`:

```typescript
import * as assert from "assert";
import { ProcessHistory } from "../src/processHistory";
import { ProcessInfo } from "../src/types";

function makeProc(pid: number, comm: string): ProcessInfo {
  return { pid, ppid: 1, cpu: 0, mem: 0, elapsed: "00:01", stat: "S", comm, children: [], ports: [] };
}

describe("ProcessHistory", () => {
  it("should detect terminated processes on update", () => {
    const history = new ProcessHistory(100);
    const terminal = { id: 0, name: "zsh", shellPid: 100, tag: undefined, processes: [] };

    // First scan: two processes
    history.update([terminal], [makeProc(200, "node"), makeProc(300, "python3")]);
    assert.strictEqual(history.getAll().length, 0);

    // Second scan: node is gone
    history.update([terminal], [makeProc(300, "python3")]);
    const terminated = history.getAll();
    assert.strictEqual(terminated.length, 1);
    assert.strictEqual(terminated[0].pid, 200);
    assert.strictEqual(terminated[0].comm, "node");
    assert.strictEqual(terminated[0].terminalName, "zsh");
  });

  it("should limit history size to maxEntries", () => {
    const history = new ProcessHistory(100, 2);

    history.update([{ id: 0, name: "zsh", shellPid: 100, tag: undefined, processes: [] }],
      [makeProc(1, "a"), makeProc(2, "b"), makeProc(3, "c")]);
    history.update([{ id: 0, name: "zsh", shellPid: 100, tag: undefined, processes: [] }], []);

    const all = history.getAll();
    assert.strictEqual(all.length, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx ts-mocha test/processHistory.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement processHistory.ts**

```typescript
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

    // Find PIDs that were in previous scan but not current
    for (const [pid, info] of this.previousPids) {
      if (!currentPids.has(pid)) {
        this.entries.push({
          pid,
          comm: info.comm,
          exitCode: undefined,
          terminatedAt: new Date().toISOString(),
          terminalName: info.terminalName,
        });
      }
    }

    // Trim to max
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    this.previousPids = currentPids;
  }

  getAll(): TerminatedProcess[] {
    return [...this.entries].reverse();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx ts-mocha test/processHistory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/processHistory.ts test/processHistory.test.ts
git commit -m "feat: process history tracking for terminated processes"
```

---

### Task 5: TerminalTracker — Track Terminals and Tags

**Files:**
- Create: `src/terminalTracker.ts`, `test/terminalTracker.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/terminalTracker.test.ts`:

```typescript
import * as assert from "assert";
import { TerminalTagStore } from "../src/terminalTracker";

describe("TerminalTagStore", () => {
  it("should store and retrieve tags", () => {
    const store = new TerminalTagStore();
    store.setTag("terminal-1", "Frontend");
    assert.strictEqual(store.getTag("terminal-1"), "Frontend");
  });

  it("should return undefined for unknown terminal", () => {
    const store = new TerminalTagStore();
    assert.strictEqual(store.getTag("unknown"), undefined);
  });

  it("should serialize and deserialize", () => {
    const store = new TerminalTagStore();
    store.setTag("t1", "Backend");
    store.setTag("t2", "DB");
    const serialized = store.serialize();
    const restored = TerminalTagStore.deserialize(serialized);
    assert.strictEqual(restored.getTag("t1"), "Backend");
    assert.strictEqual(restored.getTag("t2"), "DB");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx ts-mocha test/terminalTracker.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement terminalTracker.ts**

```typescript
import * as vscode from "vscode";
import { TerminalInfo } from "./types";

export class TerminalTagStore {
  private tags = new Map<string, string>();

  setTag(terminalKey: string, tag: string): void {
    this.tags.set(terminalKey, tag);
  }

  getTag(terminalKey: string): string | undefined {
    return this.tags.get(terminalKey);
  }

  removeTag(terminalKey: string): void {
    this.tags.delete(terminalKey);
  }

  serialize(): Record<string, string> {
    return Object.fromEntries(this.tags);
  }

  static deserialize(data: Record<string, string>): TerminalTagStore {
    const store = new TerminalTagStore();
    for (const [key, value] of Object.entries(data)) {
      store.setTag(key, value);
    }
    return store;
  }
}

export class TerminalTracker {
  private tagStore: TerminalTagStore;
  private context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const savedTags = context.workspaceState.get<Record<string, string>>("terminalTags", {});
    this.tagStore = TerminalTagStore.deserialize(savedTags);

    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        this.tagStore.removeTag(terminal.name);
        this.saveTags();
      })
    );
  }

  async getTerminals(): Promise<TerminalInfo[]> {
    const terminals: TerminalInfo[] = [];
    for (const [index, terminal] of vscode.window.terminals.entries()) {
      const pid = await terminal.processId;
      terminals.push({
        id: index,
        name: terminal.name,
        shellPid: pid ?? undefined,
        tag: this.tagStore.getTag(terminal.name),
        processes: [],
      });
    }
    return terminals;
  }

  setTag(terminalName: string, tag: string): void {
    this.tagStore.setTag(terminalName, tag);
    this.saveTags();
  }

  getTagStore(): TerminalTagStore {
    return this.tagStore;
  }

  focusTerminal(terminalId: number): void {
    const terminal = vscode.window.terminals[terminalId];
    if (terminal) {
      terminal.show();
    }
  }

  private saveTags(): void {
    this.context.workspaceState.update("terminalTags", this.tagStore.serialize());
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx ts-mocha test/terminalTracker.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminalTracker.ts test/terminalTracker.test.ts
git commit -m "feat: terminal tracker with tag management"
```

---

### Task 6: Claude Code Detector — Session Detection

**Files:**
- Create: `src/claudeCode/detector.ts`, `test/claudeCode/detector.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/claudeCode/detector.test.ts`:

```typescript
import * as assert from "assert";
import { isClaudeProcess, findClaudePids } from "../src/claudeCode/detector";
import { ProcessInfo } from "../src/types";

function makeProc(pid: number, ppid: number, comm: string): ProcessInfo {
  return { pid, ppid, cpu: 0, mem: 0, elapsed: "00:01", stat: "S", comm, children: [], ports: [] };
}

describe("ClaudeCodeDetector", () => {
  describe("isClaudeProcess", () => {
    it("should detect claude binary", () => {
      assert.ok(isClaudeProcess("/usr/bin/claude"));
      assert.ok(isClaudeProcess("/usr/local/bin/claude"));
      assert.ok(isClaudeProcess("claude"));
    });

    it("should not match non-claude processes", () => {
      assert.ok(!isClaudeProcess("node"));
      assert.ok(!isClaudeProcess("/bin/zsh"));
    });
  });

  describe("findClaudePids", () => {
    it("should find claude processes from process list", () => {
      const procs = [
        makeProc(100, 1, "/bin/zsh"),
        makeProc(200, 100, "node"),
        makeProc(300, 200, "/usr/local/bin/claude"),
        makeProc(400, 1, "/bin/zsh"),
      ];
      const pids = findClaudePids(procs);
      assert.deepStrictEqual(pids, [300]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx ts-mocha test/claudeCode/detector.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement detector.ts**

```typescript
import { ProcessInfo } from "../types";

export function isClaudeProcess(comm: string): boolean {
  const basename = comm.split("/").pop() || "";
  return basename === "claude" || basename.startsWith("claude-");
}

export function findClaudePids(processes: ProcessInfo[]): number[] {
  return processes.filter((p) => isClaudeProcess(p.comm)).map((p) => p.pid);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx ts-mocha test/claudeCode/detector.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/claudeCode/detector.ts test/claudeCode/detector.test.ts
git commit -m "feat: claude code process detection"
```

---

### Task 7: Claude Code Session Parser — Read `~/.claude/sessions/`

**Files:**
- Create: `src/claudeCode/sessionParser.ts`, `test/claudeCode/sessionParser.test.ts`, `test/fixtures/claude-session.json`

- [ ] **Step 1: Create test fixture**

Create `test/fixtures/claude-session.json`:

```json
{
  "sessionId": "abc-123-def",
  "workingDirectory": "/Users/redpug/Dev/ArgosPanoptes",
  "startTime": "2026-03-31T01:00:00.000Z",
  "processKind": "main"
}
```

- [ ] **Step 2: Write failing tests**

Create `test/claudeCode/sessionParser.test.ts`:

```typescript
import * as assert from "assert";
import * as path from "path";
import { parseSessionFile, findSessionByPid } from "../src/claudeCode/sessionParser";

const fixtureDir = path.join(__dirname, "..", "test", "fixtures");

describe("SessionParser", () => {
  describe("parseSessionFile", () => {
    it("should parse a session JSON file", () => {
      const filePath = path.join(fixtureDir, "claude-session.json");
      const session = parseSessionFile(filePath, 12345);
      assert.strictEqual(session.sessionId, "abc-123-def");
      assert.strictEqual(session.workingDirectory, "/Users/redpug/Dev/ArgosPanoptes");
      assert.strictEqual(session.startTime, "2026-03-31T01:00:00.000Z");
      assert.strictEqual(session.pid, 12345);
    });
  });

  describe("findSessionByPid", () => {
    it("should find session file matching a PID", () => {
      // This test uses the fixtures directory as a mock sessions dir
      // The fixture file is named "claude-session.json", but real files are named by PID
      // We test the parsing logic, not the file naming
      const session = findSessionByPid(fixtureDir, 0, "claude-session.json");
      assert.ok(session);
      assert.strictEqual(session!.sessionId, "abc-123-def");
    });

    it("should return undefined for non-existent PID", () => {
      const session = findSessionByPid(fixtureDir, 99999);
      assert.strictEqual(session, undefined);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx ts-mocha test/claudeCode/sessionParser.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement sessionParser.ts**

```typescript
import * as fs from "fs";
import * as path from "path";
import { ClaudeSession } from "../types";

interface RawSession {
  sessionId: string;
  workingDirectory: string;
  startTime: string;
  processKind?: string;
}

export function parseSessionFile(filePath: string, pid: number): ClaudeSession {
  const raw: RawSession = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return {
    sessionId: raw.sessionId,
    pid,
    workingDirectory: raw.workingDirectory,
    startTime: raw.startTime,
    model: undefined,
    prompts: [],
    subagents: [],
    worktreePath: undefined,
    worktreeBranch: undefined,
  };
}

export function findSessionByPid(
  sessionsDir: string,
  pid: number,
  overrideFilename?: string
): ClaudeSession | undefined {
  try {
    const filename = overrideFilename ?? `${pid}.json`;
    const filePath = path.join(sessionsDir, filename);
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    return parseSessionFile(filePath, pid);
  } catch {
    return undefined;
  }
}

export function getSessionsDir(): string {
  const home = process.env.HOME || "/Users/unknown";
  return path.join(home, ".claude", "sessions");
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx ts-mocha test/claudeCode/sessionParser.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/claudeCode/sessionParser.ts test/claudeCode/sessionParser.test.ts test/fixtures/claude-session.json
git commit -m "feat: claude code session file parser"
```

---

### Task 8: Claude Code History Parser — Read `~/.claude/history.jsonl`

**Files:**
- Create: `src/claudeCode/historyParser.ts`, `test/claudeCode/historyParser.test.ts`, `test/fixtures/claude-history.jsonl`

- [ ] **Step 1: Create test fixture**

Create `test/fixtures/claude-history.jsonl`:

```
{"type":"human","message":"fix the login bug","timestamp":"2026-03-31T01:00:00.000Z","sessionId":"abc-123-def"}
{"type":"human","message":"add unit tests","timestamp":"2026-03-31T01:05:00.000Z","sessionId":"abc-123-def"}
{"type":"human","message":"deploy to staging","timestamp":"2026-03-31T02:00:00.000Z","sessionId":"xyz-789"}
```

- [ ] **Step 2: Write failing tests**

Create `test/claudeCode/historyParser.test.ts`:

```typescript
import * as assert from "assert";
import * as path from "path";
import { parseHistoryFile, getPromptsForSession } from "../src/claudeCode/historyParser";

const fixtureDir = path.join(__dirname, "..", "test", "fixtures");

describe("HistoryParser", () => {
  const filePath = path.join(fixtureDir, "claude-history.jsonl");

  describe("parseHistoryFile", () => {
    it("should parse all human entries from history", () => {
      const entries = parseHistoryFile(filePath);
      assert.strictEqual(entries.length, 3);
      assert.strictEqual(entries[0].message, "fix the login bug");
      assert.strictEqual(entries[0].sessionId, "abc-123-def");
    });
  });

  describe("getPromptsForSession", () => {
    it("should filter prompts by sessionId", () => {
      const entries = parseHistoryFile(filePath);
      const prompts = getPromptsForSession(entries, "abc-123-def");
      assert.strictEqual(prompts.length, 2);
      assert.strictEqual(prompts[0].text, "fix the login bug");
      assert.strictEqual(prompts[1].text, "add unit tests");
    });

    it("should return empty for unknown session", () => {
      const entries = parseHistoryFile(filePath);
      const prompts = getPromptsForSession(entries, "nonexistent");
      assert.strictEqual(prompts.length, 0);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx ts-mocha test/claudeCode/historyParser.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement historyParser.ts**

```typescript
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
    return content
      .trim()
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.type === "human");
  } catch {
    return [];
  }
}

export function getPromptsForSession(
  entries: HistoryEntry[],
  sessionId: string
): ClaudePrompt[] {
  return entries
    .filter((e) => e.sessionId === sessionId)
    .map((e) => ({
      text: e.message,
      timestamp: e.timestamp,
      status: "completed" as const,
    }));
}

export function getHistoryPath(): string {
  const home = process.env.HOME || "/Users/unknown";
  return `${home}/.claude/history.jsonl`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx ts-mocha test/claudeCode/historyParser.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/claudeCode/historyParser.ts test/claudeCode/historyParser.test.ts test/fixtures/claude-history.jsonl
git commit -m "feat: claude code history.jsonl parser"
```

---

### Task 9: Claude Code Transcript Parser — Tokens, Model, Subagents

**Files:**
- Create: `src/claudeCode/transcriptParser.ts`, `test/claudeCode/transcriptParser.test.ts`, `test/fixtures/claude-transcript.jsonl`

- [ ] **Step 1: Create test fixture**

Create `test/fixtures/claude-transcript.jsonl`:

```
{"type":"system","model":"claude-opus-4-6","sessionId":"abc-123-def"}
{"type":"assistant","message":"working on it","usage":{"input_tokens":500,"output_tokens":200},"sessionId":"abc-123-def"}
{"type":"tool_use","tool":"Agent","subagent_type":"Explore","description":"search codebase","sessionId":"abc-123-def"}
{"type":"assistant","message":"done","usage":{"input_tokens":300,"output_tokens":150},"sessionId":"abc-123-def"}
```

- [ ] **Step 2: Write failing tests**

Create `test/claudeCode/transcriptParser.test.ts`:

```typescript
import * as assert from "assert";
import * as path from "path";
import { parseTranscript } from "../src/claudeCode/transcriptParser";

const fixtureDir = path.join(__dirname, "..", "test", "fixtures");

describe("TranscriptParser", () => {
  const filePath = path.join(fixtureDir, "claude-transcript.jsonl");

  describe("parseTranscript", () => {
    it("should extract model name", () => {
      const result = parseTranscript(filePath);
      assert.strictEqual(result.model, "claude-opus-4-6");
    });

    it("should sum token usage", () => {
      const result = parseTranscript(filePath);
      assert.strictEqual(result.inputTokens, 800);
      assert.strictEqual(result.outputTokens, 350);
    });

    it("should find subagents", () => {
      const result = parseTranscript(filePath);
      assert.strictEqual(result.subagents.length, 1);
      assert.strictEqual(result.subagents[0].type, "Explore");
      assert.strictEqual(result.subagents[0].description, "search codebase");
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx ts-mocha test/claudeCode/transcriptParser.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement transcriptParser.ts**

```typescript
import * as fs from "fs";
import { SubagentInfo } from "../types";

export interface TranscriptSummary {
  model: string | undefined;
  inputTokens: number;
  outputTokens: number;
  subagents: SubagentInfo[];
}

export function parseTranscript(filePath: string): TranscriptSummary {
  const result: TranscriptSummary = {
    model: undefined,
    inputTokens: 0,
    outputTokens: 0,
    subagents: [],
  };

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.trim());

    for (const line of lines) {
      const entry = JSON.parse(line);

      if (entry.model && !result.model) {
        result.model = entry.model;
      }

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
  } catch {
    // File may not exist or be malformed
  }

  return result;
}

export function estimateCost(
  model: string | undefined,
  inputTokens: number,
  outputTokens: number
): number {
  // Pricing per million tokens (as of 2026)
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-opus-4-6": { input: 15, output: 75 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  };

  const rates = pricing[model || ""] || pricing["claude-sonnet-4-6"];
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx ts-mocha test/claudeCode/transcriptParser.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/claudeCode/transcriptParser.ts test/claudeCode/transcriptParser.test.ts test/fixtures/claude-transcript.jsonl
git commit -m "feat: transcript parser for tokens, model, and subagents"
```

---

### Task 10: Sidebar Webview Provider

**Files:**
- Create: `src/sidebar/sidebarProvider.ts`

- [ ] **Step 1: Implement sidebarProvider.ts**

```typescript
import * as vscode from "vscode";
import { DashboardData, WebviewMessage } from "../types";
import { getNonce } from "../utils";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "argosPanoptes.sidebar";

  private view?: vscode.WebviewView;
  private onMessage?: (message: WebviewMessage) => void;

  constructor(private readonly extensionUri: vscode.Uri) {}

  setMessageHandler(handler: (message: WebviewMessage) => void): void {
    this.onMessage = handler;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      this.onMessage?.(message);
    });
  }

  updateData(data: DashboardData): void {
    this.view?.webview.postMessage({ type: "update", data });
  }

  private getHtml(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "style.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "main.js")
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div id="controls">
    <input type="text" id="search" placeholder="Filter processes..." />
    <button id="refresh-btn" title="Refresh">&#x21bb;</button>
    <span id="countdown">5s</span>
  </div>
  <div id="claude-sessions"></div>
  <div id="terminals"></div>
  <div id="history-panel">
    <h3>Recently Terminated</h3>
    <div id="history-list"></div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
```

- [ ] **Step 2: Compile to verify no errors**

```bash
npx tsc -p ./
```

Expected: no compile errors.

- [ ] **Step 3: Commit**

```bash
git add src/sidebar/sidebarProvider.ts
git commit -m "feat: sidebar webview provider"
```

---

### Task 11: Webview Frontend — HTML/CSS/JS

**Files:**
- Create: `media/main.js`, `media/style.css`

- [ ] **Step 1: Create style.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
  padding: 8px;
}

#controls {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
  position: sticky;
  top: 0;
  background: var(--vscode-sideBar-background);
  padding: 4px 0;
  z-index: 10;
}

#search {
  flex: 1;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  padding: 4px 8px;
  border-radius: 3px;
  outline: none;
}

#refresh-btn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
}

#refresh-btn:hover {
  background: var(--vscode-button-hoverBackground);
}

#countdown {
  font-size: 11px;
  opacity: 0.6;
  min-width: 20px;
}

/* Terminal cards */
.terminal-card {
  margin-bottom: 8px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--vscode-editor-background);
  cursor: pointer;
  user-select: none;
}

.terminal-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.terminal-name {
  font-weight: bold;
  flex: 1;
}

.terminal-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
}

.terminal-tag-input {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 8px;
  width: 80px;
  outline: none;
}

.terminal-body {
  padding: 4px 8px;
}

/* Process tree */
.process-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 12px;
}

.process-item:hover {
  background: var(--vscode-list-hoverBackground);
  border-radius: 2px;
}

.process-indent {
  display: inline-block;
}

.process-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.process-stats {
  display: flex;
  gap: 8px;
  font-size: 11px;
  opacity: 0.7;
}

.port-badge {
  font-size: 10px;
  padding: 0 4px;
  background: var(--vscode-terminal-ansiGreen);
  color: var(--vscode-editor-background);
  border-radius: 3px;
  cursor: pointer;
}

.port-badge:hover {
  opacity: 0.8;
}

.kill-btn {
  background: none;
  border: none;
  color: var(--vscode-errorForeground);
  cursor: pointer;
  font-size: 12px;
  padding: 0 4px;
  opacity: 0.6;
}

.kill-btn:hover {
  opacity: 1;
}

.focus-btn {
  background: none;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: 11px;
  opacity: 0.6;
}

.focus-btn:hover {
  opacity: 1;
}

/* Claude Code section */
.claude-section {
  margin-bottom: 12px;
}

.claude-section h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
  margin-bottom: 6px;
}

.claude-card {
  margin-bottom: 8px;
  border: 1px solid var(--vscode-terminal-ansiBlue);
  border-radius: 4px;
  overflow: hidden;
}

.claude-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--vscode-editor-background);
}

.model-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--vscode-terminal-ansiBlue);
  color: var(--vscode-editor-background);
  font-weight: bold;
}

.claude-body {
  padding: 6px 8px;
  font-size: 12px;
}

.claude-info-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
  opacity: 0.8;
}

.claude-info-label {
  opacity: 0.6;
}

.prompt-timeline {
  margin-top: 6px;
  border-top: 1px solid var(--vscode-panel-border);
  padding-top: 4px;
}

.prompt-item {
  padding: 3px 0;
  font-size: 11px;
  border-left: 2px solid var(--vscode-terminal-ansiGreen);
  padding-left: 8px;
  margin: 2px 0;
}

.prompt-item.in-progress {
  border-left-color: var(--vscode-terminal-ansiYellow);
}

.prompt-time {
  opacity: 0.5;
  font-size: 10px;
}

.subagent-tree {
  margin-top: 4px;
  padding-left: 12px;
}

.subagent-item {
  font-size: 11px;
  padding: 2px 0;
  opacity: 0.8;
}

.worktree-info {
  font-size: 11px;
  opacity: 0.7;
  padding: 2px 0;
}

/* History panel */
#history-panel {
  margin-top: 12px;
  border-top: 1px solid var(--vscode-panel-border);
  padding-top: 8px;
}

#history-panel h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
  margin-bottom: 6px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  padding: 2px 0;
  opacity: 0.6;
}

.exit-code-ok {
  color: var(--vscode-terminal-ansiGreen);
}

.exit-code-fail {
  color: var(--vscode-errorForeground);
}

/* Collapse */
.collapsed .terminal-body,
.collapsed .claude-body {
  display: none;
}

.collapse-icon::before {
  content: "▼";
  font-size: 10px;
  display: inline-block;
  transition: transform 0.15s;
}

.collapsed .collapse-icon::before {
  transform: rotate(-90deg);
}
```

- [ ] **Step 2: Create main.js**

```javascript
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  let currentData = null;
  let searchFilter = "";
  let countdownSeconds = 5;
  let countdownInterval = null;

  const searchInput = document.getElementById("search");
  const refreshBtn = document.getElementById("refresh-btn");
  const countdownEl = document.getElementById("countdown");
  const claudeSessionsEl = document.getElementById("claude-sessions");
  const terminalsEl = document.getElementById("terminals");
  const historyListEl = document.getElementById("history-list");

  searchInput.addEventListener("input", (e) => {
    searchFilter = e.target.value.toLowerCase();
    render();
  });

  refreshBtn.addEventListener("click", () => {
    vscode.postMessage({ command: "refresh" });
    resetCountdown();
  });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "update") {
      currentData = msg.data;
      render();
      resetCountdown();
    }
  });

  function resetCountdown() {
    countdownSeconds = 5;
    updateCountdownDisplay();
  }

  function updateCountdownDisplay() {
    countdownEl.textContent = countdownSeconds + "s";
  }

  countdownInterval = setInterval(() => {
    countdownSeconds = Math.max(0, countdownSeconds - 1);
    updateCountdownDisplay();
  }, 1000);

  function render() {
    if (!currentData) return;
    renderClaudeSessions(currentData.claudeSessions);
    renderTerminals(currentData.terminals);
    renderHistory(currentData.history);
  }

  function renderClaudeSessions(sessions) {
    if (!sessions || sessions.length === 0) {
      claudeSessionsEl.innerHTML = "";
      return;
    }

    claudeSessionsEl.innerHTML =
      '<div class="claude-section"><h3>Claude Code Sessions</h3>' +
      sessions.map((s) => renderClaudeCard(s)).join("") +
      "</div>";
  }

  function renderClaudeCard(session) {
    const modelShort = session.model
      ? session.model.replace("claude-", "").split("-").slice(0, 2).join(" ")
      : "unknown";
    const startTime = new Date(session.startTime).toLocaleTimeString();
    const tokenTotal = (session.inputTokens || 0) + (session.outputTokens || 0);
    const cost = session.estimatedCost
      ? "$" + session.estimatedCost.toFixed(4)
      : "";

    let promptsHtml = "";
    if (session.prompts && session.prompts.length > 0) {
      promptsHtml =
        '<div class="prompt-timeline">' +
        session.prompts
          .map(
            (p) =>
              '<div class="prompt-item ' +
              p.status +
              '"><span class="prompt-time">' +
              new Date(p.timestamp).toLocaleTimeString() +
              "</span> " +
              escapeHtml(p.text.substring(0, 100)) +
              (p.text.length > 100 ? "..." : "") +
              "</div>"
          )
          .join("") +
        "</div>";
    }

    let subagentsHtml = "";
    if (session.subagents && session.subagents.length > 0) {
      subagentsHtml =
        '<div class="subagent-tree">' +
        session.subagents
          .map(
            (a) =>
              '<div class="subagent-item">&#x2514; ' +
              escapeHtml(a.type) +
              " — " +
              escapeHtml(a.description) +
              "</div>"
          )
          .join("") +
        "</div>";
    }

    let worktreeHtml = "";
    if (session.worktreeBranch) {
      worktreeHtml =
        '<div class="worktree-info">&#x1f333; ' +
        escapeHtml(session.worktreeBranch) +
        (session.worktreePath ? " (" + escapeHtml(session.worktreePath) + ")" : "") +
        "</div>";
    }

    return (
      '<div class="claude-card">' +
      '<div class="claude-header" onclick="toggleCollapse(this.parentElement)">' +
      '<span class="collapse-icon"></span>' +
      '<span class="terminal-name">' +
      escapeHtml(session.sessionId.substring(0, 8)) +
      "</span>" +
      '<span class="model-badge">' +
      escapeHtml(modelShort) +
      "</span>" +
      '<button class="focus-btn" onclick="event.stopPropagation(); focusTerminal(' +
      session.terminalId +
      ')">&#x25B6;</button>' +
      "</div>" +
      '<div class="claude-body">' +
      '<div class="claude-info-row"><span class="claude-info-label">Started</span><span>' +
      startTime +
      "</span></div>" +
      '<div class="claude-info-row"><span class="claude-info-label">Tokens</span><span>' +
      tokenTotal.toLocaleString() +
      "</span></div>" +
      (cost
        ? '<div class="claude-info-row"><span class="claude-info-label">Cost</span><span>' +
          cost +
          "</span></div>"
        : "") +
      '<div class="claude-info-row"><span class="claude-info-label">Directory</span><span>' +
      escapeHtml(session.workingDirectory) +
      "</span></div>" +
      worktreeHtml +
      promptsHtml +
      subagentsHtml +
      "</div></div>"
    );
  }

  function renderTerminals(terminals) {
    if (!terminals || terminals.length === 0) {
      terminalsEl.innerHTML = '<div style="opacity:0.5;padding:8px;">No terminals open</div>';
      return;
    }

    const filtered = terminals.map((t) => ({
      ...t,
      processes: filterProcesses(t.processes, searchFilter),
    }));

    terminalsEl.innerHTML = filtered.map((t) => renderTerminalCard(t)).join("");
  }

  function filterProcesses(processes, filter) {
    if (!filter) return processes;
    return processes
      .map((p) => {
        const matchesSelf = p.comm.toLowerCase().includes(filter);
        const filteredChildren = filterProcesses(p.children || [], filter);
        if (matchesSelf || filteredChildren.length > 0) {
          return { ...p, children: filteredChildren };
        }
        return null;
      })
      .filter(Boolean);
  }

  function renderTerminalCard(terminal) {
    const tagHtml = terminal.tag
      ? '<span class="terminal-tag">' + escapeHtml(terminal.tag) + "</span>"
      : '<span class="terminal-tag" onclick="event.stopPropagation(); promptTag(' +
        terminal.id +
        ', this)" style="opacity:0.4;cursor:pointer;">+ tag</span>';

    return (
      '<div class="terminal-card">' +
      '<div class="terminal-header" onclick="toggleCollapse(this.parentElement)">' +
      '<span class="collapse-icon"></span>' +
      '<span class="terminal-name">' +
      escapeHtml(terminal.name) +
      "</span>" +
      tagHtml +
      '<button class="focus-btn" onclick="event.stopPropagation(); focusTerminal(' +
      terminal.id +
      ')">&#x25B6;</button>' +
      "</div>" +
      '<div class="terminal-body">' +
      renderProcessTree(terminal.processes, 0, terminal.id) +
      "</div></div>"
    );
  }

  function renderProcessTree(processes, depth, terminalId) {
    if (!processes || processes.length === 0) {
      return depth === 0
        ? '<div style="opacity:0.4;font-size:11px;padding:2px 0;">No processes</div>'
        : "";
    }

    return processes
      .map((p) => {
        const indent = '<span class="process-indent" style="width:' + depth * 14 + 'px"></span>';
        const portsHtml = (p.ports || [])
          .map(
            (port) =>
              '<span class="port-badge" onclick="event.stopPropagation(); openPort(' +
              port +
              ')">' +
              port +
              "</span>"
          )
          .join("");

        return (
          '<div class="process-item">' +
          indent +
          '<span class="process-name">' +
          escapeHtml(p.comm.split("/").pop() || p.comm) +
          "</span>" +
          portsHtml +
          '<span class="process-stats">' +
          '<span title="CPU">' +
          p.cpu.toFixed(1) +
          "%</span>" +
          '<span title="Memory">' +
          p.mem.toFixed(1) +
          "%</span>" +
          '<span title="Elapsed">' +
          p.elapsed +
          "</span>" +
          "</span>" +
          '<button class="kill-btn" onclick="event.stopPropagation(); killProcess(' +
          p.pid +
          ')" title="Kill process">&#x2715;</button>' +
          "</div>" +
          renderProcessTree(p.children || [], depth + 1, terminalId)
        );
      })
      .join("");
  }

  function renderHistory(history) {
    if (!history || history.length === 0) {
      historyListEl.innerHTML = '<div style="opacity:0.4;font-size:11px;">No history yet</div>';
      return;
    }

    historyListEl.innerHTML = history
      .slice(0, 20)
      .map((h) => {
        const exitClass =
          h.exitCode === 0
            ? "exit-code-ok"
            : h.exitCode !== undefined
              ? "exit-code-fail"
              : "";
        const exitText =
          h.exitCode !== undefined ? " (exit " + h.exitCode + ")" : "";
        const time = new Date(h.terminatedAt).toLocaleTimeString();
        return (
          '<div class="history-item"><span>' +
          escapeHtml(h.comm) +
          '<span class="' +
          exitClass +
          '">' +
          exitText +
          "</span></span><span>" +
          time +
          "</span></div>"
        );
      })
      .join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  // Global functions called from onclick handlers
  window.toggleCollapse = function (el) {
    el.classList.toggle("collapsed");
  };

  window.killProcess = function (pid) {
    if (confirm("Kill process " + pid + "?")) {
      vscode.postMessage({ command: "kill", pid: pid });
    }
  };

  window.focusTerminal = function (terminalId) {
    vscode.postMessage({ command: "focusTerminal", terminalId: terminalId });
  };

  window.openPort = function (port) {
    vscode.postMessage({ command: "openPort", port: port });
  };

  window.promptTag = function (terminalId, el) {
    const input = document.createElement("input");
    input.className = "terminal-tag-input";
    input.placeholder = "Tag...";
    el.replaceWith(input);
    input.focus();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && input.value.trim()) {
        vscode.postMessage({
          command: "setTag",
          terminalId: terminalId,
          tag: input.value.trim(),
        });
      }
      if (e.key === "Escape") {
        render();
      }
    });
    input.addEventListener("blur", function () {
      render();
    });
  };
})();
```

- [ ] **Step 3: Compile to verify**

```bash
npx tsc -p ./
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add media/main.js media/style.css
git commit -m "feat: webview frontend with process tree, claude dashboard, and controls"
```

---

### Task 12: Wire Everything Together in extension.ts

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Implement full extension.ts**

Replace `src/extension.ts` with:

```typescript
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
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
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
      const transcriptDir = path.join(
        process.env.HOME || "",
        ".claude",
        "transcripts"
      );
      if (fs.existsSync(transcriptDir)) {
        const files = fs.readdirSync(transcriptDir).filter((f) => f.endsWith(".jsonl"));
        // Find transcript matching session
        for (const file of files) {
          const filePath = path.join(transcriptDir, file);
          const summary = parseTranscript(filePath);
          if (summary.model) {
            session.model = summary.model;
            (session as any).inputTokens = summary.inputTokens;
            (session as any).outputTokens = summary.outputTokens;
            (session as any).estimatedCost = estimateCost(
              summary.model,
              summary.inputTokens,
              summary.outputTokens
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
        const proc = allProcesses.find((p) => p.pid === pid);
        if (proc) {
          const cwd = await getProcessCwd(pid);
          if (cwd && cwd.includes(".git/worktrees")) {
            const parts = cwd.split("/");
            const wtIndex = parts.indexOf("worktrees");
            if (wtIndex >= 0) {
              session.worktreePath = cwd;
              session.worktreeBranch = parts[wtIndex + 1];
            }
          }
        }
      } catch {
        // Worktree detection is best-effort
      }

      claudeSessions.push(session);
    }
  }

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
      if (err) {
        reject(err);
        return;
      }
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
      // Handled by the refresh cycle
      break;
  }
}

export function deactivate() {}
```

- [ ] **Step 2: Compile to verify**

```bash
npx tsc -p ./
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: wire all components together in extension entry point"
```

---

### Task 13: Integration Test — Manual Launch

- [ ] **Step 1: Compile the full project**

```bash
npm run compile
```

Expected: clean build, no errors.

- [ ] **Step 2: Test in Extension Development Host**

Press F5 in VSCode (or run the "Run Extension" launch config). Verify:
- Activity bar icon appears
- Clicking it opens the sidebar webview
- Terminals are listed with process trees
- Search/filter works
- Kill button works (with confirmation)
- Port badges show and are clickable
- Terminal tags can be set
- Claude Code sessions appear if running
- Refresh button and auto-refresh work

- [ ] **Step 3: Fix any issues found during manual testing**

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes"
```

---

### Task 14: README and Final Polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README.md**

Replace contents with:

```markdown
# Argos Panoptes

VSCode extension for monitoring terminal processes and Claude Code sessions. macOS only.

## Features

- **Process Tree** — View all processes running in each terminal with CPU, memory, and uptime
- **Port Display** — See listening ports per process, click to open in browser
- **Process History** — Track recently terminated processes with exit codes
- **Terminal Tags** — Label terminals for quick identification
- **Kill & Focus** — Kill processes or jump to their terminal
- **Claude Code Dashboard** — Session info, prompt timeline, token usage, cost estimation, sub-agent tree, worktree display

## Development

```bash
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

## Usage

1. Click the Argos Panoptes icon in the Activity Bar
2. View process trees for each open terminal
3. Use the search bar to filter processes
4. Click port badges to open in browser
5. Click + tag to label terminals
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with project description and usage"
```
