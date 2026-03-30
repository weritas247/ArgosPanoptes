// Minimal vscode mock for unit tests
export const window = {
  onDidCloseTerminal: () => ({ dispose: () => {} }),
  terminals: [] as any[],
};

export class Disposable {
  dispose() {}
}

export interface ExtensionContext {}
