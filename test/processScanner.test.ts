import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { parsePsOutput, buildProcessTree } from "../src/processScanner";

const fixtureDir = path.join(__dirname, "..", "test", "fixtures");

describe("ProcessScanner", () => {
  const psOutput = fs.readFileSync(path.join(fixtureDir, "ps-output.txt"), "utf-8");

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
      assert.strictEqual(tree.length, 2);
      const nodeProc = tree.find((p) => p.comm === "node");
      assert.ok(nodeProc);
      assert.strictEqual(nodeProc!.children.length, 1);
      assert.strictEqual(nodeProc!.children[0].comm, "/usr/bin/claude");
      assert.strictEqual(nodeProc!.children[0].children.length, 1);
    });
    it("should return empty array for PID with no children", () => {
      const processes = parsePsOutput(psOutput);
      const tree = buildProcessTree(processes, 99999);
      assert.strictEqual(tree.length, 0);
    });
  });
});
