export type Capabilities = {
  limit: { context: number }
  capabilities: { reasoning: boolean; toolcall: boolean; input: { image: boolean } }
}

export function modelCapabilityTags(model: Capabilities) {
  return [
    ...(model.capabilities.reasoning ? (["reasoning"] as const) : []),
    ...(model.capabilities.input.image ? (["vision"] as const) : []),
    ...(model.capabilities.toolcall ? (["tools"] as const) : []),
  ]
}
