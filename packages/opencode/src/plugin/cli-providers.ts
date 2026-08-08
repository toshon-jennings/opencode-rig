import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { CliAuth } from "@opencode-ai/core/cli-auth"

const api = "https://api.commandcode.ai/provider/v1"
export async function CliProvidersPlugin(_input: PluginInput): Promise<Hooks> {
  return {
    async config(config) {
      const [commandModels, codex, claude] = await Promise.all([
        CliAuth.commandCodeModels(),
        CliAuth.codexLoggedIn(),
        CliAuth.claudeLoggedIn(),
      ])
      config.provider ??= {}
      config.provider["command-code"] = {
        name: "Command Code Provider API",
        npm: "@ai-sdk/openai-compatible",
        api,
        models: Object.fromEntries(
          (commandModels.length ? commandModels : CliAuth.commandCodeFallbackModels).map((model) => [
            model.id,
            {
              name: model.name ?? model.id,
              tool_call: true,
              limit: { context: model.context_length ?? 200_000, output: 32_000 },
              provider: {
                npm: model.id.startsWith("claude-") ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible",
                api,
              },
            },
          ]),
        ),
      }
      if (codex) {
        config.provider["codex-cli"] = cliProvider("Codex CLI", [
          ["gpt-5.6-sol", "GPT-5.6 Sol"],
          ["gpt-5.6-terra", "GPT-5.6 Terra"],
          ["gpt-5.6-luna", "GPT-5.6 Luna"],
        ])
      }
      if (claude) {
        config.provider["claude-cli"] = cliProvider("Claude CLI", [
          ["claude-fable-5", "Claude Fable 5"],
          ["claude-opus-5", "Claude Opus 5"],
          ["claude-sonnet-5", "Claude Sonnet 5"],
          ["claude-haiku-4-5", "Claude Haiku 4.5"],
        ])
      }
    },
  }
}

export async function CommandCodeAuthPlugin(_input: PluginInput): Promise<Hooks> {
  return {
    auth: {
      provider: "command-code",
      methods: [{ type: "api", label: "Command Code provider API key (Provider plan required)" }],
    },
  }
}

function cliProvider(name: string, models: ReadonlyArray<readonly [string, string]>) {
  return {
    name,
    npm: "@opencode-ai/cli-agent",
    models: Object.fromEntries(
      models.map(([id, modelName]) => [
        id,
        {
          name: modelName,
          tool_call: false,
          limit: { context: 200_000, output: 32_000 },
        },
      ]),
    ),
  }
}
