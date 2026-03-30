import * as assert from "assert";
import * as path from "path";
import { parseSessionFile, findSessionByPid } from "../../src/claudeCode/sessionParser";

const fixtureDir = path.join(__dirname, "..", "..", "test", "fixtures");

describe("SessionParser", () => {
  describe("parseSessionFile", () => {
    it("should parse a session JSON file", () => {
      const filePath = path.join(fixtureDir, "claude-session.json");
      const session = parseSessionFile(filePath, 12345);
      assert.strictEqual(session.sessionId, "abc-123-def");
      assert.strictEqual(session.workingDirectory, "/Users/redpug/Dev/ArgosPanoptes");
      assert.strictEqual(session.startTime, "2026-03-31T01:00:00.000Z");
      assert.strictEqual(session.pid, 12345);
    });
  });

  describe("findSessionByPid", () => {
    it("should find session file matching a PID", () => {
      const session = findSessionByPid(fixtureDir, 0, "claude-session.json");
      assert.ok(session);
      assert.strictEqual(session!.sessionId, "abc-123-def");
    });
    it("should return undefined for non-existent PID", () => {
      const session = findSessionByPid(fixtureDir, 99999);
      assert.strictEqual(session, undefined);
    });
  });
});
