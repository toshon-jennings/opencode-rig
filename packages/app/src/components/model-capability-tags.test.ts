import { expect, test } from "bun:test"

import { modelCapabilityTags } from "./model-capability-tags"

const full = {
  limit: { context: 200_000 },
  capabilities: { reasoning: true, input: { image: true }, toolcall: true },
}

// Regression guard for v0.2.3: four shrink-0 chips in a ~300px selector row left the model
// name as the only shrinkable element, so names rendered as "Bi…" / "D…". A compact row must
// never carry more than the context chip.
test("compact rows carry the context chip only", () => {
  expect(modelCapabilityTags(full, true)).toEqual(["context"])
})

test("non-compact carries the full capability set", () => {
  expect(modelCapabilityTags(full)).toEqual(["context", "reasoning", "vision", "tools"])
})

test("omits the context chip when the model reports no limit", () => {
  expect(modelCapabilityTags({ capabilities: { reasoning: true } }, true)).toEqual([])
  expect(modelCapabilityTags({ capabilities: { reasoning: true } })).toEqual(["reasoning"])
})

test("treats a zero context limit as absent rather than rendering an empty chip", () => {
  expect(modelCapabilityTags({ limit: { context: 0 } }, true)).toEqual([])
})
