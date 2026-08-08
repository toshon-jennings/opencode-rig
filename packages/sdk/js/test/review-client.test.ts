import { expect, test } from "bun:test"
import { createOpencodeClient } from "../src/v2/client"

test("includes the configured location in review requests", async () => {
  let request: Request | undefined
  const client = createOpencodeClient({
    baseUrl: "https://opencode.test",
    directory: "/workspace/project",
    experimental_workspaceID: "workspace_test",
    headers: { authorization: "Bearer test" },
    fetch: async (input, init) => {
      request = new Request(input, init)
      return new Response(JSON.stringify({ data: { id: "review_test", files: [] } }), {
        headers: { "content-type": "application/json" },
      })
    },
  })

  await client.review.capture()

  if (!request) throw new Error("Expected review request")
  const url = new URL(request.url)
  expect(url.searchParams.get("location[directory]")).toBe("/workspace/project")
  expect(url.searchParams.get("location[workspace]")).toBe("workspace_test")
  expect(request.headers.get("authorization")).toBe("Bearer test")
})
