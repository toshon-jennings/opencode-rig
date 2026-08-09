export type ModelCapabilityTag = "context" | "reasoning" | "vision" | "tools"

export type ModelCapabilityInfo = {
  limit?: { context?: number }
  capabilities?: { reasoning?: boolean; input?: { image?: boolean }; toolcall?: boolean }
}

// Selector rows are ~300px and every chip renders shrink-0, so the model name is the only
// element flexbox can shrink. v0.2.3 shipped with reasoning/vision/tools chips beside the
// pre-existing Free/Latest tags and names collapsed to "Bi…". Compact rows therefore carry
// the context window only — the one capability worth comparing at a glance — and the rest
// stay in ModelTooltip, which has room for them.
export function modelCapabilityTags(model: ModelCapabilityInfo, compact = false): ModelCapabilityTag[] {
  const tags: ModelCapabilityTag[] = []
  if (model.limit?.context) tags.push("context")
  if (compact) return tags
  if (model.capabilities?.reasoning) tags.push("reasoning")
  if (model.capabilities?.input?.image) tags.push("vision")
  if (model.capabilities?.toolcall) tags.push("tools")
  return tags
}
