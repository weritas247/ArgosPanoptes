import * as assert from "assert";
import * as path from "path";
import { parseTranscript, estimateCost } from "../../src/claudeCode/transcriptParser";

const fixtureDir = path.join(__dirname, "..", "..", "test", "fixtures");

describe("TranscriptParser", () => {
  const filePath = path.join(fixtureDir, "claude-transcript.jsonl");

  describe("parseTranscript", () => {
    it("should extract model name", () => {
      const result = parseTranscript(filePath);
      assert.strictEqual(result.model, "claude-opus-4-6");
    });
    it("should sum token usage", () => {
      const result = parseTranscript(filePath);
      assert.strictEqual(result.inputTokens, 800);
      assert.strictEqual(result.outputTokens, 350);
    });
    it("should find subagents", () => {
      const result = parseTranscript(filePath);
      assert.strictEqual(result.subagents.length, 1);
      assert.strictEqual(result.subagents[0].type, "Explore");
      assert.strictEqual(result.subagents[0].description, "search codebase");
    });
  });

  describe("estimateCost", () => {
    it("should estimate cost for opus model", () => {
      const cost = estimateCost("claude-opus-4-6", 1000000, 1000000);
      assert.strictEqual(cost, 15 + 75); // $15 input + $75 output per million
    });
    it("should default to sonnet pricing for unknown model", () => {
      const cost = estimateCost("unknown-model", 1000000, 1000000);
      assert.strictEqual(cost, 3 + 15);
    });
  });
});
