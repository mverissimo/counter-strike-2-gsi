import { describe, expect, it, vi } from "vitest";

import { createSSEClient, createWSClient } from "../../../transport";

vi.mock("react", () => {
  throw new Error("The transport entry must not load React");
});

describe("@client: transport entry", () => {
  it("creates both transport adapters without React or browser globals", () => {
    expect(createSSEClient({ url: "http://gsi.test/sse" })).toEqual({
      connect: expect.any(Function),
      disconnect: expect.any(Function),
      subscribe: expect.any(Function),
    });
    expect(createWSClient({ url: "ws://gsi.test/ws" })).toEqual({
      connect: expect.any(Function),
      disconnect: expect.any(Function),
      subscribe: expect.any(Function),
    });
  });
});
