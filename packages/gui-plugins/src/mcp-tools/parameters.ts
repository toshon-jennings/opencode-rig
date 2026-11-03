import { Option, Schema } from "effect"
import type { McpTool } from "@opencode/client/promise"

export type Parameter = {
  readonly name: string
  readonly type?: string
  readonly description?: string
  readonly required: boolean
}

// The JSON Schema keywords the inspector shows. Others are ignored; a property that does not fit reads as untyped.
interface Property {
  readonly type?: string | ReadonlyArray<string>
  readonly description?: string
  readonly items?: Property
  readonly anyOf?: ReadonlyArray<Property>
  readonly oneOf?: ReadonlyArray<Property>
}

const Property: Schema.Codec<Property> = Schema.Struct({
  type: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  description: Schema.optional(Schema.String),
  items: Schema.optional(Schema.suspend(() => Property)),
  anyOf: Schema.optional(Schema.Array(Schema.suspend(() => Property))),
  oneOf: Schema.optional(Schema.Array(Schema.suspend(() => Property))),
})

const decodeProperties = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Json))

const decodeProperty = Schema.decodeUnknownOption(Property)

const decodeRequired = Schema.decodeUnknownOption(Schema.Array(Schema.String))

/** The top-level properties of a tool's input, as its server declared them. */
export function parameters(schema: McpTool["inputSchema"]): Parameter[] {
  const required = new Set(decodeRequired(schema.required).pipe(Option.getOrElse(() => [])))
  const properties = decodeProperties(schema.properties).pipe(Option.getOrElse(() => ({})))

  return Object.entries(properties).map(([name, value]) => {
    const property = decodeProperty(value).pipe(Option.getOrElse((): Property => ({})))

    return { name, type: typeName(property), description: property.description, required: required.has(name) }
  })
}

// `string`, `string | null`, `number[]`; unions from `anyOf`/`oneOf`, which zod and pydantic emit for optional fields.
function typeName(property: Property): string | undefined {
  const union = property.anyOf ?? property.oneOf

  if (union) {
    const names = union.flatMap((item) => typeName(item) ?? [])

    return names.length ? [...new Set(names)].join(" | ") : undefined
  }

  const types = property.type === undefined ? [] : [property.type].flat()

  if (types.length > 1) return types.join(" | ")

  if (types[0] === "array" && property.items) {
    const item = typeName(property.items)

    if (item) return item.includes(" | ") ? `(${item})[]` : `${item}[]`
  }

  return types[0]
}
