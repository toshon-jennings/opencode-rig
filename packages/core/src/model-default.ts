export * as ModelDefault from "./model-default"

export const providerID = "opencode"
export const modelID = "longcat-2.0-free"

export function find<T extends { providerID: string; id: string }>(models: Iterable<T>) {
  return Array.from(models).find((model) => model.providerID === providerID && model.id === modelID)
}

export function select(
  providers: readonly { id: string; models: Record<string, { id: string }> }[],
  defaults: Record<string, string>,
) {
  const preferred = providers.find((provider) => provider.id === providerID)?.models[modelID]
  if (preferred) return { providerID, modelID: preferred.id }

  return providers.flatMap((provider) => {
    const model = defaults[provider.id] ?? Object.values(provider.models)[0]?.id
    return model ? [{ providerID: provider.id, modelID: model }] : []
  })[0]
}

export function free(model: { providerID: string; cost?: { input: number } }) {
  return model.providerID === providerID && (!model.cost || model.cost.input === 0)
}
