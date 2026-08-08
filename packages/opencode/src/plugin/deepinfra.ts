import type { Hooks, PluginInput } from "@opencode-ai/plugin"

export async function DeepInfraAuthPlugin(_input: PluginInput): Promise<Hooks> {
  return {
    auth: {
      provider: "deepinfra",
      methods: [{ type: "api", label: "DeepInfra API key or scoped JWT" }],
    },
  }
}
