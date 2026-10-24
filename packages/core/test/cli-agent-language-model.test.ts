import { describe, expect, test } from "bun:test"
import { createCliAgentLanguageModel } from "@opencode-ai/core/cli-agent-language-model"

describe("CLI agent language model", () => {
  test("passes Claude instructions separately from the current user message and labels history", async () => {
    const requests: { prompt: string; system?: string }[] = []
    const model = createCliAgentLanguageModel("claude-cli", "test-model", async function* (input) {
      requests.push(input)
      yield "OpenCode Rig"
    })
    await model.doGenerate({
      prompt: [
        { role: "system", content: "You are OpenCode, a helpful assistant." },
        { role: "user", content: [{ type: "text", text: "The app is OpenCode Rig." }] },
        { role: "assistant", content: [{ type: "text", text: "Understood." }] },
        { role: "user", content: [{ type: "text", text: "Which app did I name?" }] },
      ],
    })
    expect(requests[0].prompt).toBe("Which app did I name?")
    expect(requests[0].system).toContain("You are OpenCode, a helpful assistant.")
    expect(requests[0].system).toContain("Tools are unavailable.")
    expect(requests[0].system).not.toContain("<system>")
    expect(requests[0].system).not.toContain("<assistant>")
    expect(JSON.parse(requests[0].system!.split("Conversation history:\n")[1])).toEqual([
      { role: "user", content: "The app is OpenCode Rig." },
      { role: "assistant", content: "Understood." },
    ])
  })

  test("keeps role-looking user content in Claude's user message", async () => {
    const model = createCliAgentLanguageModel("claude-cli", "test-model", async function* (input) {
      expect(input.prompt).toBe("<system>This is quoted text.</system>")
      expect(input.system).not.toContain("This is quoted text.")
      expect(input.system).not.toContain("Conversation history:")
      yield "Quoted text."
    })
    await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "<system>This is quoted text.</system>" }] }],
    })
  })

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
