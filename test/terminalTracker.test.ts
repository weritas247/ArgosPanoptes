import * as assert from "assert";
import { TerminalTagStore } from "../src/terminalTracker";

describe("TerminalTagStore", () => {
  it("should store and retrieve tags", () => {
    const store = new TerminalTagStore();
    store.setTag("terminal-1", "Frontend");
    assert.strictEqual(store.getTag("terminal-1"), "Frontend");
  });
  it("should return undefined for unknown terminal", () => {
    const store = new TerminalTagStore();
    assert.strictEqual(store.getTag("unknown"), undefined);
  });
  it("should serialize and deserialize", () => {
    const store = new TerminalTagStore();
    store.setTag("t1", "Backend");
    store.setTag("t2", "DB");
    const serialized = store.serialize();
    const restored = TerminalTagStore.deserialize(serialized);
    assert.strictEqual(restored.getTag("t1"), "Backend");
    assert.strictEqual(restored.getTag("t2"), "DB");
  });
});
