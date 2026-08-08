import { describe, expect, it } from "bun:test"
import { matchMcpTools, parseParameters } from "./dialog-select-mcp-helpers"

describe("dialog-select-mcp helpers", () => {
  it("matchMcpTools filters tools by server name prefix", () => {
    const tools = [
      { id: "cassandra_world_brief", description: "World brief", parameters: {} },
      { id: "mcp_cassandra_get_events", description: "Get events", parameters: {} },
      { id: "github_create_issue", description: "Create issue", parameters: {} },
      { id: "code-review-graph_query", description: "Query graph", parameters: {} },
    ]

    const cassandraTools = matchMcpTools(tools, "cassandra")
    expect(cassandraTools.map((tool) => tool.id)).toEqual(["cassandra_world_brief"])

    const graphTools = matchMcpTools(tools, "code-review-graph")
    expect(graphTools.map((tool) => tool.id)).toEqual(["code-review-graph_query"])
    expect(matchMcpTools(tools, "git")).toEqual([])
  })

  it("parseParameters extracts schema properties and required fields", () => {
    const parameters = {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string" },
        limit: { type: ["number", "null"], description: "Maximum results" },
      },
      required: ["query"],
    }

    const parsed = parseParameters(parameters)
    expect(parsed).toEqual([
      { name: "query", type: "string", description: "Search query string", required: true },
      { name: "limit", type: "number | null", description: "Maximum results", required: false },
    ])
  })

  it("parseParameters handles invalid or empty inputs gracefully", () => {
    expect(parseParameters(null)).toEqual([])
    expect(parseParameters(undefined)).toEqual([])
    expect(parseParameters({})).toEqual([])
  })
})
