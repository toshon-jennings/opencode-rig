import fs from "node:fs/promises"
import path from "node:path"
import { expect } from "bun:test"
import { Effect, Schedule } from "effect"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { it } from "../../core/test/lib/effect"
import { ServerFetch } from "../src/fetch"

it.live("lists the tools of a location's connected MCP servers", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("opencode-mcp-tool-endpoint-")))
    const global = path.join(tmp.path, "global")
    yield* Effect.promise(async () => {
      await fs.mkdir(global)
      await fs.writeFile(
        path.join(tmp.path, "opencode.json"),
        JSON.stringify({
          mcp: {
            servers: {
              docs: {
                type: "local",
                command: [process.execPath, path.join(import.meta.dir, "../../core/test/fixture/mcp-output-schema.ts")],
              },
            },
          },
        }),
      )
    })
    const handler = yield* ServerFetch.make({
      database: { path: ":memory:" },
      config: { directory: global },
      fs: { filewatcher: false },
      models: { fetch: false },
    })
    const url = new URL("/api/experimental/mcp/tool", "http://opencode.local")
    url.searchParams.set("location[directory]", tmp.path)
    // Servers connect in the background; the list reports them once they have.
    const tools = yield* Effect.promise(async () => {
      const response = await handler(new Request(url))
      expect(response.status).toBe(200)
      return (await response.json()).data
    }).pipe(
      Effect.repeat({ while: (data) => data.length === 0, schedule: Schedule.spaced("50 millis") }),
      Effect.timeout("10 seconds"),
    )

    // Only the declared fields go over the wire; the output schema stays on the server.
    expect(tools).toEqual([
      { server: "docs", name: "first", inputSchema: { type: "object" } },
      { server: "docs", name: "second", inputSchema: { type: "object" } },
    ])
  }),
)
