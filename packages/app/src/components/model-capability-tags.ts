export type ModelCapabilityTag = "context" | "reasoning" | "vision" | "tools"

export type ModelCapabilityInfo = {
  limit?: { context?: number }
  capabilities?: { reasoning?: boolean; input?: { image?: boolean }; toolcall?: boolean }
}

// Every chip renders shrink-0, so the model name is the only element flexbox can shrink.
// v0.2.3 shipped these chips into a 284px-wide popover and names collapsed to "Bi…". The
// fix is the popover width (see dialog-select-model.tsx) plus a min-width floor on the
// name — NOT dropping capabilities, which is real information the row should carry.
export function modelCapabilityTags(model: ModelCapabilityInfo): ModelCapabilityTag[] {
  const tags: ModelCapabilityTag[] = []
  if (model.limit?.context) tags.push("context")
  if (model.capabilities?.reasoning) tags.push("reasoning")
  if (model.capabilities?.input?.image) tags.push("vision")
  if (model.capabilities?.toolcall) tags.push("tools")
  return tags
}
