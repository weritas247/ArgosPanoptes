import * as assert from "assert";
import * as path from "path";
import { parseHistoryFile, getPromptsForSession } from "../../src/claudeCode/historyParser";

const fixtureDir = path.join(__dirname, "..", "..", "test", "fixtures");

describe("HistoryParser", () => {
  const filePath = path.join(fixtureDir, "claude-history.jsonl");

  describe("parseHistoryFile", () => {
    it("should parse all human entries from history", () => {
      const entries = parseHistoryFile(filePath);
      assert.strictEqual(entries.length, 3);
      assert.strictEqual(entries[0].display, "fix the login bug");
      assert.strictEqual(entries[0].sessionId, "abc-123-def");
    });
  });

  describe("getPromptsForSession", () => {
    it("should filter prompts by sessionId", () => {
      const entries = parseHistoryFile(filePath);
      const prompts = getPromptsForSession(entries, "abc-123-def");
      assert.strictEqual(prompts.length, 2);
      assert.strictEqual(prompts[0].text, "fix the login bug");
      assert.strictEqual(prompts[1].text, "add unit tests");
    });
    it("should return empty for unknown session", () => {
      const entries = parseHistoryFile(filePath);
      const prompts = getPromptsForSession(entries, "nonexistent");
      assert.strictEqual(prompts.length, 0);
    });
  });
});
