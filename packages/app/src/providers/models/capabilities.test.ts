import { expect, test } from "bun:test"
import { modelCapabilityTags } from "./capabilities"

const model = (reasoning: boolean, image: boolean, toolcall: boolean) => ({
  limit: { context: 1 },
  capabilities: { reasoning, toolcall, input: { image } },
})

test("lists only the capabilities a model has", () => {
  expect(modelCapabilityTags(model(true, true, true))).toEqual(["reasoning", "vision", "tools"])
  expect(modelCapabilityTags(model(false, true, false))).toEqual(["vision"])
  expect(modelCapabilityTags(model(false, false, false))).toEqual([])
})
