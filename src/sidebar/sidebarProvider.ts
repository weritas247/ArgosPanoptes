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
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "style.css"));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "main.js"));
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
