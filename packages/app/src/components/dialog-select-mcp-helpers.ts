export type ToolParameterProperty = {
  type?: string
  description?: string
}

export type ToolParametersSchema = {
  type?: string
  properties?: Record<string, ToolParameterProperty>
  required?: string[]
}

export type McpToolItem = {
  id: string
  description?: string
  parameters?: unknown
}

export type ParameterDetail = {
  name: string
  type?: string
  description?: string
  required: boolean
}

export function sanitizeMcpName(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "_")
}

export function matchMcpTools(tools: McpToolItem[], serverName: string): McpToolItem[] {
  const sanitized = sanitizeMcpName(serverName).toLowerCase()
  const lower = serverName.toLowerCase()
  return tools.filter((tool) => {
    const id = tool.id.toLowerCase()
    return (
      id.startsWith(`${sanitized}_`) ||
      id.startsWith(`mcp_${sanitized}_`) ||
      id.startsWith(`${lower}_`) ||
      id.startsWith(`mcp_${lower}_`) ||
      id.startsWith(`${lower}/`) ||
      id.includes(sanitized) ||
      id.includes(lower)
    )
  })
}

export function parseParameters(parameters: unknown): ParameterDetail[] {
  if (typeof parameters !== "object" || parameters === null) return []
  const schema = parameters as ToolParametersSchema
  if (!schema.properties || typeof schema.properties !== "object") return []
  const requiredSet = new Set(Array.isArray(schema.required) ? schema.required : [])
  return Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    type: typeof prop?.type === "string" ? prop.type : undefined,
    description: typeof prop?.description === "string" ? prop.description : undefined,
    required: requiredSet.has(name),
  }))
}
