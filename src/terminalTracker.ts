import * as vscode from "vscode";
import { TerminalInfo } from "./types";

export class TerminalTagStore {
  private tags = new Map<string, string>();

  setTag(terminalKey: string, tag: string): void { this.tags.set(terminalKey, tag); }
  getTag(terminalKey: string): string | undefined { return this.tags.get(terminalKey); }
  removeTag(terminalKey: string): void { this.tags.delete(terminalKey); }

  serialize(): Record<string, string> { return Object.fromEntries(this.tags); }

  static deserialize(data: Record<string, string>): TerminalTagStore {
    const store = new TerminalTagStore();
    for (const [key, value] of Object.entries(data)) store.setTag(key, value);
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
      vscode.window.onDidCloseTerminal((terminal) => { this.tagStore.removeTag(terminal.name); this.saveTags(); })
    );
  }

  async getTerminals(): Promise<TerminalInfo[]> {
    const terminals: TerminalInfo[] = [];
    for (const [index, terminal] of vscode.window.terminals.entries()) {
      const pid = await terminal.processId;
      terminals.push({ id: index, name: terminal.name, shellPid: pid ?? undefined, tag: this.tagStore.getTag(terminal.name), processes: [] });
    }
    return terminals;
  }

  setTag(terminalName: string, tag: string): void { this.tagStore.setTag(terminalName, tag); this.saveTags(); }
  getTagStore(): TerminalTagStore { return this.tagStore; }
  focusTerminal(terminalId: number): void { const t = vscode.window.terminals[terminalId]; if (t) t.show(); }
  private saveTags(): void { this.context.workspaceState.update("terminalTags", this.tagStore.serialize()); }
  dispose(): void { this.disposables.forEach((d) => d.dispose()); }
}
