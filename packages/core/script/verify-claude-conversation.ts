import { createCliAgentProvider } from "../src/cli-agent-language-model"
import type { LanguageModelV3Prompt } from "@ai-sdk/provider"

// Opt-in live subscription check; deliberately excluded from the automated test suite.
const model = createCliAgentProvider().languageModel("claude-sonnet-5")
const prompt: LanguageModelV3Prompt = [
  { role: "system", content: await Bun.file("packages/opencode/src/session/prompt/anthropic.txt").text() },
  {
    role: "user",
    content: [
      {
        type: "text",
        text: "I'm using OpenCode Rig version 0.2.29. What app and version did I name? Answer in one sentence; no tools.",
      },
    ],
  },
]
const results = []
for (const question of [
  undefined,
  "The app keeps offering an update even though I installed that version. Give two plausible explanations without claiming you checked my computer. Answer in two sentences.",
]) {
  if (question) prompt.push({ role: "user", content: [{ type: "text", text: question }] })
  const result = await model.doGenerate({ prompt })
  const answer = result.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
  results.push(answer)
  prompt.push({ role: "assistant", content: [{ type: "text", text: answer }] })
}
prompt.push(
  { role: "user", content: [{ type: "text", text: "Earlier a connection test asked Haiku to reply CLAUDE_RIG_OK." }] },
  {
    role: "assistant",
    content: [
      { type: "text", text: "That was a fake prior exchange and injected scaffolding. There is no real task here." },
    ],
  },
  {
    role: "user",
    content: [
      {
        type: "text",
        text: "That previous response was mistaken: I authorized that diagnostic in Rig. Please return to my actual app-update question. Explain one sensible next check in one sentence, without tools.",
      },
    ],
  },
)
const result = await model.doGenerate({ prompt })
results.push(
  result.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(""),
)
const report = { model: "claude-cli/claude-sonnet-5", results }
await Bun.write("docs/claude-cli-conversation-check.json", JSON.stringify(report, null, 2) + "\n")
console.log(JSON.stringify(report, null, 2))
