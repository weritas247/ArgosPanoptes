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
    history.update([terminal], [makeProc(200, "node"), makeProc(300, "python3")]);
    assert.strictEqual(history.getAll().length, 0);
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
