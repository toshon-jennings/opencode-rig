import { describe, expect, test } from "bun:test"
import { ModelDefault } from "../src/model-default"

describe("model default", () => {
  test("prefers free LongCat on OpenCode Zen when available", () => {
    expect(
      ModelDefault.select(
        [
          { id: "anthropic", models: { sonnet: { id: "sonnet" } } },
          {
            id: "opencode",
            models: {
              paid: { id: "paid" },
              "longcat-2.0-free": { id: "longcat-2.0-free" },
            },
          },
        ],
        { anthropic: "sonnet", opencode: "paid" },
      ),
    ).toEqual({ providerID: "opencode", modelID: "longcat-2.0-free" })
  })

  test("falls back to the provider default when free LongCat is unavailable", () => {
    expect(
      ModelDefault.select([{ id: "anthropic", models: { sonnet: { id: "sonnet" } } }], { anthropic: "sonnet" }),
    ).toEqual({ providerID: "anthropic", modelID: "sonnet" })
  })

  test("recognizes free OpenCode Zen models", () => {
    expect(ModelDefault.free({ providerID: "opencode", cost: { input: 0 } })).toBe(true)
    expect(ModelDefault.free({ providerID: "opencode", cost: { input: 1 } })).toBe(false)
    expect(ModelDefault.free({ providerID: "openrouter", cost: { input: 0 } })).toBe(false)
  })
})
