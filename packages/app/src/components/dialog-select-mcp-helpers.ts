import type { ToolListItem } from "@opencode-ai/sdk/v2/client"

export type ParameterDetail = {
  name: string
  type?: string
  description?: string
  required: boolean
}

export function sanitizeMcpName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_")
}

export function matchMcpTools(tools: ToolListItem[], serverName: string) {
  const prefix = `${sanitizeMcpName(serverName).toLowerCase()}_`
  return tools.filter((tool) => tool.id.toLowerCase().startsWith(prefix))
}

export function parseParameters(parameters: unknown): ParameterDetail[] {
  if (!isRecord(parameters) || !isRecord(parameters.properties)) return []
  const required = Array.isArray(parameters.required)
    ? new Set(parameters.required.filter((item): item is string => typeof item === "string"))
    : new Set<string>()
  return Object.entries(parameters.properties).map(([name, property]) => {
    const value = isRecord(property) ? property : {}
    const type = Array.isArray(value.type)
      ? value.type.filter((item): item is string => typeof item === "string").join(" | ")
      : typeof value.type === "string"
        ? value.type
        : undefined
    return {
      name,
      type,
      description: typeof value.description === "string" ? value.description : undefined,
      required: required.has(name),
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
