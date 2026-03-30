# Argos Panoptes

VSCode extension for monitoring terminal processes and Claude Code sessions. macOS only.

## Features

- **Process Tree** — View all processes running in each terminal with CPU, memory, and uptime
- **Port Display** — See listening ports per process, click to open in browser
- **Process History** — Track recently terminated processes with exit codes
- **Terminal Tags** — Label terminals for quick identification
- **Search/Filter** — Filter processes by name across all terminals
- **Kill & Focus** — Kill processes or jump to their terminal
- **Claude Code Dashboard** — Session info, prompt timeline, token usage, cost estimation, sub-agent tree, worktree display

## Development

```bash
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

## Testing

```bash
npm test
```

## Usage

1. Click the Argos Panoptes icon in the Activity Bar
2. View process trees for each open terminal
3. Use the search bar to filter processes
4. Click port badges to open in browser
5. Click + tag to label terminals
6. Claude Code sessions appear automatically with detailed info
