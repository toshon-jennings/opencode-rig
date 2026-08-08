import { Effect } from "effect"
import type { PluginContext } from "@opencode-ai/plugin/v2/effect"
import { CliAuth } from "../../cli-auth"
import { createCliAgentLanguageModel, runClaudeAgent, runCodexAppServer } from "../../cli-agent-language-model"
import { ModelV2 } from "../../model"
import { ProviderV2 } from "../../provider"
import { define } from "../internal"

const packageID = "@opencode-ai/cli-agent"
const codexID = ProviderV2.ID.make("codex-cli")
const claudeID = ProviderV2.ID.make("claude-cli")

const codex = [
  ["gpt-5.6-sol", "GPT-5.6 Sol"],
  ["gpt-5.6-terra", "GPT-5.6 Terra"],
  ["gpt-5.6-luna", "GPT-5.6 Luna"],
] as const

const claude = [
  ["claude-fable-5", "Claude Fable 5"],
  ["claude-opus-5", "Claude Opus 5"],
  ["claude-sonnet-5", "Claude Sonnet 5"],
  ["claude-haiku-4-5", "Claude Haiku 4.5"],
] as const

export const CliAgentsPlugin = define({
  id: "cli-agents",
  effect: Effect.fn(function* (ctx) {
    const [hasCodex, hasClaude] = yield* Effect.promise(() =>
      Promise.all([CliAuth.codexLoggedIn(), CliAuth.claudeLoggedIn()]),
    )
    yield* ctx.integration.transform((draft) => {
      if (hasCodex) {
        draft.update("codex-cli", (integration) => (integration.name = "Codex CLI"))
        draft.method.update({
          integrationID: "codex-cli",
          method: { id: "codex-cli-login", type: "external", label: "Codex ChatGPT login" },
        })
      }
      if (hasClaude) {
        draft.update("claude-cli", (integration) => (integration.name = "Claude CLI"))
        draft.method.update({
          integrationID: "claude-cli",
          method: { id: "claude-cli-login", type: "external", label: "Claude CLI login" },
        })
      }
    })
    yield* ctx.catalog.transform((draft) => {
      register(draft, codexID, "Codex CLI", "codex-cli", codex)
      register(draft, claudeID, "Claude CLI", "claude-cli", claude)
    })
    yield* ctx.aisdk.sdk((evt) => {
      if (evt.package !== packageID) return
      evt.sdk = {
        languageModel: (model: string) =>
          evt.model.providerID === codexID
            ? createCliAgentLanguageModel("codex-cli", model, runCodexAppServer)
            : createCliAgentLanguageModel("claude-cli", model, runClaudeAgent),
      }
    })
  }),
})

function register(
  draft: Parameters<Parameters<PluginContext["catalog"]["transform"]>[0]>[0],
  providerID: ProviderV2.ID,
  name: string,
  integrationID: string,
  models: ReadonlyArray<readonly [string, string]>,
) {
  draft.provider.update(providerID, (provider) => {
    provider.name = name
    provider.integrationID = integrationID
    provider.api = { type: "aisdk", package: packageID }
  })
  for (const [id, modelName] of models) {
    draft.model.update(providerID, id, (model) => {
      model.name = modelName
      model.api = { id: ModelV2.ID.make(id), type: "aisdk", package: packageID }
      model.capabilities = { tools: false, input: ["text"], output: ["text"] }
      model.limit = { context: 200_000, output: 32_000 }
    })
  }
}
