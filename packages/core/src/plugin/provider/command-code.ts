import { Effect } from "effect"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { CliAuth } from "../../cli-auth"
import { Credential } from "../../credential"
import { ModelV2 } from "../../model"
import { ProviderV2 } from "../../provider"
import { define } from "../internal"

const providerID = ProviderV2.ID.make("command-code")
const integrationID = "command-code"
const methodID = "command-code-cli"
const baseURL = "https://api.commandcode.ai/provider/v1"

export const CommandCodePlugin = define({
  id: "command-code",
  effect: Effect.fn(function* (ctx) {
    const key = yield* Effect.promise(CliAuth.commandCodeKey)
    if (key) {
      yield* ctx.integration.transform((draft) => {
        draft.update(integrationID, (integration) => (integration.name = "Command Code Provider API"))
        draft.method.update({
          integrationID,
          method: { id: methodID, type: "external", label: "Command Code CLI login" },
          resolve: () => Effect.promise(CliAuth.commandCodeKey).pipe(Effect.map((value) => credential(value))),
        })
      })
    }
    yield* ctx.integration.transform((draft) => {
      draft.update(integrationID, (integration) => (integration.name = "Command Code Provider API"))
      draft.method.update({ integrationID, method: { type: "key", label: "Command Code provider API key" } })
      draft.method.update({ integrationID, method: { type: "env", names: ["COMMAND_CODE_API_KEY"] } })
    })

    const discovered = yield* Effect.promise(() => CliAuth.commandCodeModels(key))
    const models = discovered.length ? discovered : CliAuth.commandCodeFallbackModels
    yield* ctx.catalog.transform((draft) => {
      draft.provider.update(providerID, (provider) => {
        provider.name = "Command Code Provider API"
        provider.integrationID = integrationID
        provider.api = { type: "aisdk", package: "@ai-sdk/openai-compatible", url: baseURL }
      })
      for (const item of models) {
        draft.model.update(providerID, item.id, (model) => {
          model.name = item.name ?? item.id
          model.api = {
            id: ModelV2.ID.make(item.id),
            type: "aisdk",
            package: item.id.startsWith("claude-") ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible",
            url: baseURL,
          }
          model.capabilities = { tools: true, input: ["text"], output: ["text"] }
          model.limit = { context: item.context_length ?? 200_000, output: 32_000 }
        })
      }
    })

    yield* ctx.aisdk.sdk(
      Effect.fn(function* (evt) {
        if (evt.model.providerID !== providerID) return
        const connection = yield* ctx.integration.connection.active(integrationID)
        const resolved = connection
          ? yield* ctx.integration.connection.resolve(connection).pipe(Effect.orDie)
          : undefined
        const apiKey = resolved?.type === "key" ? resolved.key : undefined
        if (!apiKey) throw new Error("Command Code provider access requires a CLI login or provider API key")
        evt.sdk =
          evt.package === "@ai-sdk/anthropic"
            ? createAnthropic({ ...evt.options, apiKey, baseURL })
            : createOpenAICompatible({ ...evt.options, apiKey, baseURL, name: "command-code" })
      }),
    )
  }),
})

function credential(key: string | undefined) {
  return key ? Credential.Key.make({ type: "key", key }) : undefined
}
