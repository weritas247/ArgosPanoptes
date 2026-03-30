# ArgosPanoptes — Design Spec

## Overview

VSCode sidebar Webview extension for macOS. Monitors running processes across all open terminals and provides a dedicated Claude Code session dashboard.

## Features

### General Process Monitoring

#### Process Tree
- Display per-terminal process tree with parent-child relationships
- Show: program name, PID, CPU%, memory%, uptime, status
- 5-second auto-refresh + manual refresh button

#### Actions
- Kill process (with confirmation dialog)
- Focus terminal — click to switch to the terminal tab running that process

#### Search & Filter
- Filter processes by program name across all terminals

#### Port Display
- Show listening port numbers per process (e.g., `localhost:3000`)
- Click to open in browser

#### Process History
- Log recently terminated processes with exit codes
- Persisted in memory during the session (not across restarts)

#### Terminal Tags
- User-assigned labels per terminal (e.g., "Frontend", "Backend", "DB")
- Stored in extension state, persisted across sessions

### Claude Code Session Features

#### Session Detection
- Auto-detect `claude` processes, display in a dedicated section
- Separate from general terminal process list

#### Session Info
- Session name, creation time, active model (Opus/Sonnet/Haiku)

#### Prompt Display
- Show the prompt text entered into the Claude Code session

#### Session Timeline
- Chronological prompt history per session
- Each prompt shows status: in-progress / completed

#### Token Usage
- Per-session token consumption
- Source: Claude Code local state files (`~/.claude/`)

#### Cost Estimation
- Estimated cost based on token usage and model pricing

#### Sub-agent Tree
- Tree view of spawned sub-agents and their status

#### Worktree Display
- If session operates in a git worktree, show branch name and path

#### Session Switching
- Click to focus the terminal running that Claude Code session

## Architecture

```
Extension Host (Node.js)
├── TerminalTracker
│   ├── Watch vscode.window.terminals for open/close events
│   ├── Collect shell PIDs via Terminal.processId
│   └── Manage user-assigned terminal tags
│
├── ProcessScanner
│   ├── Run `ps -eo pid,ppid,pcpu,pmem,etime,stat,comm` periodically
│   ├── Build process tree per terminal shell PID
│   └── Run `lsof -iTCP -sTCP:LISTEN -P` for port info
│
├── ProcessHistory
│   ├── Diff successive scans to detect terminated processes
│   └── Store recent terminations with exit codes (in-memory)
│
├── ClaudeCodeDetector
│   ├── Identify `claude` processes from scan results
│   ├── Parse session info from ~/.claude/ state files
│   ├── Extract prompt, model, token usage from local logs
│   ├── Track sub-agent processes (child tree of claude PID)
│   └── Detect git worktree from process working directory
│
└── SidebarWebviewProvider
    ├── Register as WebviewViewProvider for sidebar panel
    ├── Push JSON data to webview on each scan cycle
    └── Handle action messages from webview (kill, focus, open port)

Webview (HTML/CSS/JS)
├── General Terminals Section
│   ├── Collapsible per-terminal cards with tag labels
│   ├── Process tree with indentation for parent-child
│   ├── Search/filter input
│   └── Port badges with click-to-open
│
├── Claude Code Section
│   ├── Session cards with model badge, creation time
│   ├── Prompt timeline (chronological list)
│   ├── Token usage + cost display
│   └── Sub-agent tree view
│
├── History Panel
│   └── Recently terminated processes with exit codes
│
└── Controls
    ├── Refresh button
    └── Auto-refresh indicator (5s countdown)
```

## Data Sources

| Information | Source | Method |
|---|---|---|
| Process tree | `ps -eo pid,ppid,pcpu,pmem,etime,stat,comm` | Shell exec, 5s interval |
| Listening ports | `lsof -iTCP -sTCP:LISTEN -P` | Shell exec, 5s interval |
| Claude session info | `~/.claude/` state files | File read |
| Claude tokens/cost | Claude Code local logs | File read/parse |
| Terminal list | `vscode.window.terminals` | VSCode API event |
| Terminal PID | `Terminal.processId` | VSCode API |
| Terminal tags | `ExtensionContext.workspaceState` | VSCode API |

## Tech Stack

- **Language**: TypeScript (Extension + Webview)
- **APIs**: VSCode Extension API, Webview API
- **OS Commands**: macOS `ps`, `lsof`
- **Target**: macOS only

## Constraints

- `Terminal.processId` returns the shell PID only; child processes require `ps` parsing
- Claude Code state file structure may change across versions — detection should degrade gracefully
- Port scanning via `lsof` may require elevated permissions for some processes
- Webview runs in a sandboxed iframe — communication via `postMessage` only
