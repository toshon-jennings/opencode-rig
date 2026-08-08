import { describe, expect, test } from "bun:test"
import { createCliAgentLanguageModel } from "@opencode-ai/core/cli-agent-language-model"

describe("CLI agent language model", () => {
  test("serializes chat history and streams backend text", async () => {
    let received = ""
    const model = createCliAgentLanguageModel("test-cli", "test-model", async function* (input) {
      received = input.prompt
      yield "hello"
      yield " world"
    })
    const result = await model.doStream({
      prompt: [
        { role: "system", content: "Be concise." },
        { role: "user", content: [{ type: "text", text: "Say hello." }] },
      ],
    })
    const parts = []
    for await (const part of result.stream) parts.push(part)

    expect(received).toContain("<system>\nBe concise.\n</system>")
    expect(received).toContain("<user>\nSay hello.\n</user>")
    expect(parts.filter((part) => part.type === "text-delta").map((part) => part.delta)).toEqual(["hello", " world"])
    expect(parts.at(-1)).toMatchObject({ type: "finish", finishReason: { unified: "stop" } })
  })

  test("supports non-streaming generation", async () => {
    const model = createCliAgentLanguageModel("test-cli", "test-model", async function* () {
      yield "complete"
    })
    const result = await model.doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "Go" }] }] })
    expect(result.content).toEqual([{ type: "text", text: "complete" }])
  })
})
