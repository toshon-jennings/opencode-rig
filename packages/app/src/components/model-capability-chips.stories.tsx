import { ModelCapabilityChips } from "./dialog-select-model"

const model = {
  limit: { context: 1_500_000 },
  capabilities: {
    reasoning: true,
    input: { image: true },
    toolcall: true,
  },
}

export default {
  title: "App/Model/CapabilityChips",
  id: "app-model-capability-chips",
  tags: ["autodocs"],
}

export const Default = {
  render: () => <ModelCapabilityChips model={model} />,
}

export const V2 = {
  render: () => <ModelCapabilityChips model={model} v2 />,
}
