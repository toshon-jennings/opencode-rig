import { expect, test } from "bun:test"

import { modelCapabilityTags } from "./model-capability-tags"

const full = {
  limit: { context: 200_000 },
  capabilities: { reasoning: true, input: { image: true }, toolcall: true },
}

// v0.2.3 shipped these chips into a 284px popover, where every chip is shrink-0 and the
// model name was the only thing flexbox could shrink — names rendered as "Bi…". The fix is
// the popover width plus a min-width floor on the name, NOT dropping capabilities: the row
// is supposed to carry all of them.
test("carries every capability the model reports", () => {
  expect(modelCapabilityTags(full)).toEqual(["context", "reasoning", "vision", "tools"])
})

test("omits capabilities the model does not report", () => {
  expect(modelCapabilityTags({ limit: { context: 200_000 } })).toEqual(["context"])
  expect(modelCapabilityTags({ capabilities: { reasoning: true } })).toEqual(["reasoning"])
})

test("treats a zero context limit as absent rather than rendering an empty chip", () => {
  expect(modelCapabilityTags({ limit: { context: 0 } })).toEqual([])
})
