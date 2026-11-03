import { expect, test } from "bun:test"
import { parameters } from "./parameters"

test("reads names, types, descriptions and required fields", () => {
  expect(
    parameters({
      type: "object",
      properties: {
        query: { type: "string", description: "Search terms" },
        limit: { type: "number" },
      },
      required: ["query"],
    }),
  ).toEqual([
    { name: "query", type: "string", description: "Search terms", required: true },
    { name: "limit", type: "number", description: undefined, required: false },
  ])
})

test("names unions and arrays", () => {
  expect(
    parameters({
      type: "object",
      properties: {
        nullable: { type: ["string", "null"] },
        optional: { anyOf: [{ type: "string" }, { type: "null" }] },
        tags: { type: "array", items: { type: "string" } },
        mixed: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
        list: { type: "array" },
      },
    }).map((parameter) => parameter.type),
  ).toEqual(["string | null", "string | null", "string[]", "(string | number)[]", "array"])
})

test("skips what it cannot read", () => {
  expect(parameters({ type: "object" })).toEqual([])
  expect(parameters({ type: "object", properties: [] })).toEqual([])
  expect(
    parameters({ type: "object", properties: { odd: "text", ref: { $ref: "#/defs/x" } }, required: "odd" }),
  ).toEqual([
    { name: "odd", type: undefined, description: undefined, required: false },
    { name: "ref", type: undefined, description: undefined, required: false },
  ])
})
