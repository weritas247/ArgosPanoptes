import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { parseLsofOutput } from "../src/portScanner";
const fixtureDir = path.join(__dirname, "..", "test", "fixtures");

describe("PortScanner", () => {
  const lsofOutput = fs.readFileSync(path.join(fixtureDir, "lsof-output.txt"), "utf-8");
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
