import { expect, test } from "bun:test"
import { buildClientParams } from "../src/v2/gen/core/params.gen"

test("buildClientParams keeps dynamic keys off object prototypes", () => {
  const input = JSON.parse('{"$query___proto__":{"polluted":true}}')
  const params = buildClientParams([input], [{ allowExtra: { query: true } }])

  expect(Object.getPrototypeOf(params.query)).toBeNull()
  expect(Object.prototype).not.toHaveProperty("polluted")
})
