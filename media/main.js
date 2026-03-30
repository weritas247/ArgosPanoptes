(function () {
  const vscode = acquireVsCodeApi();

  let currentData = null;
  let searchFilter = "";
  let countdownSeconds = 5;

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

  setInterval(() => {
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
    const cost = session.estimatedCost ? "$" + session.estimatedCost.toFixed(4) : "";

    let promptsHtml = "";
    if (session.prompts && session.prompts.length > 0) {
      promptsHtml =
        '<div class="prompt-timeline">' +
        session.prompts
          .map(
            (p) =>
              '<div class="prompt-item ' + p.status + '"><span class="prompt-time">' +
              new Date(p.timestamp).toLocaleTimeString() +
              "</span> " + escapeHtml(p.text.substring(0, 100)) +
              (p.text.length > 100 ? "..." : "") + "</div>"
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
              escapeHtml(a.type) + " &mdash; " + escapeHtml(a.description) + "</div>"
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
      '<span class="terminal-name">' + escapeHtml(session.sessionId.substring(0, 8)) + "</span>" +
      '<span class="model-badge">' + escapeHtml(modelShort) + "</span>" +
      '<button class="focus-btn" onclick="event.stopPropagation(); focusTerminal(' +
      session.terminalId + ')">&#x25B6;</button>' +
      "</div>" +
      '<div class="claude-body">' +
      '<div class="claude-info-row"><span class="claude-info-label">Started</span><span>' + startTime + "</span></div>" +
      '<div class="claude-info-row"><span class="claude-info-label">Tokens</span><span>' + tokenTotal.toLocaleString() + "</span></div>" +
      (cost ? '<div class="claude-info-row"><span class="claude-info-label">Cost</span><span>' + cost + "</span></div>" : "") +
      '<div class="claude-info-row"><span class="claude-info-label">Directory</span><span>' + escapeHtml(session.workingDirectory) + "</span></div>" +
      worktreeHtml + promptsHtml + subagentsHtml +
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
        terminal.id + ', this)" style="opacity:0.4;cursor:pointer;">+ tag</span>';

    return (
      '<div class="terminal-card">' +
      '<div class="terminal-header" onclick="toggleCollapse(this.parentElement)">' +
      '<span class="collapse-icon"></span>' +
      '<span class="terminal-name">' + escapeHtml(terminal.name) + "</span>" +
      tagHtml +
      '<button class="focus-btn" onclick="event.stopPropagation(); focusTerminal(' +
      terminal.id + ')">&#x25B6;</button>' +
      "</div>" +
      '<div class="terminal-body">' +
      renderProcessTree(terminal.processes, 0) +
      "</div></div>"
    );
  }

  function renderProcessTree(processes, depth) {
    if (!processes || processes.length === 0) {
      return depth === 0 ? '<div style="opacity:0.4;font-size:11px;padding:2px 0;">No processes</div>' : "";
    }
    return processes
      .map((p) => {
        const indent = '<span class="process-indent" style="width:' + depth * 14 + 'px"></span>';
        const portsHtml = (p.ports || [])
          .map((port) => '<span class="port-badge" onclick="event.stopPropagation(); openPort(' + port + ')">' + port + "</span>")
          .join("");
        return (
          '<div class="process-item">' + indent +
          '<span class="process-name">' + escapeHtml(p.comm.split("/").pop() || p.comm) + "</span>" +
          portsHtml +
          '<span class="process-stats">' +
          '<span title="CPU">' + p.cpu.toFixed(1) + "%</span>" +
          '<span title="Memory">' + p.mem.toFixed(1) + "%</span>" +
          '<span title="Elapsed">' + p.elapsed + "</span>" +
          "</span>" +
          '<button class="kill-btn" onclick="event.stopPropagation(); killProcess(' + p.pid + ')" title="Kill process">&#x2715;</button>' +
          "</div>" +
          renderProcessTree(p.children || [], depth + 1)
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
        const exitClass = h.exitCode === 0 ? "exit-code-ok" : h.exitCode !== undefined ? "exit-code-fail" : "";
        const exitText = h.exitCode !== undefined ? " (exit " + h.exitCode + ")" : "";
        const time = new Date(h.terminatedAt).toLocaleTimeString();
        return (
          '<div class="history-item"><span>' + escapeHtml(h.comm) +
          '<span class="' + exitClass + '">' + exitText + "</span></span><span>" + time + "</span></div>"
        );
      })
      .join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  window.toggleCollapse = function (el) { el.classList.toggle("collapsed"); };
  window.killProcess = function (pid) {
    if (confirm("Kill process " + pid + "?")) { vscode.postMessage({ command: "kill", pid: pid }); }
  };
  window.focusTerminal = function (terminalId) { vscode.postMessage({ command: "focusTerminal", terminalId: terminalId }); };
  window.openPort = function (port) { vscode.postMessage({ command: "openPort", port: port }); };
  window.promptTag = function (terminalId, el) {
    const input = document.createElement("input");
    input.className = "terminal-tag-input";
    input.placeholder = "Tag...";
    el.replaceWith(input);
    input.focus();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && input.value.trim()) {
        vscode.postMessage({ command: "setTag", terminalId: terminalId, tag: input.value.trim() });
      }
      if (e.key === "Escape") { render(); }
    });
    input.addEventListener("blur", function () { render(); });
  };
})();
