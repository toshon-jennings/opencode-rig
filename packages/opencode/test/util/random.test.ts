import { expect, test } from "bun:test"
import { randomString } from "@/util/random"

test("randomString returns the requested alphabet without modulo bias", () => {
  const value = randomString(1_000, "ABC")

  expect(value).toHaveLength(1_000)
  expect(value).toMatch(/^[ABC]+$/)
  expect(new Set(value).size).toBeGreaterThan(1)
})
