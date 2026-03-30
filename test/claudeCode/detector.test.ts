import * as assert from "assert";
import { isClaudeProcess, findClaudePids } from "../../src/claudeCode/detector";
import { ProcessInfo } from "../../src/types";

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
