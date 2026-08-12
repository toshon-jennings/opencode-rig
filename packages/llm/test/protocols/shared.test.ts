import { expect, test } from "bun:test"
import { trimBaseUrl } from "../../src/protocols/shared"

test("trimBaseUrl removes only trailing slashes in linear time", () => {
  expect(trimBaseUrl("https://example.com/path///")).toBe("https://example.com/path")
  expect(trimBaseUrl(`https://example.com${"/".repeat(10_000)}`)).toBe("https://example.com")
})
