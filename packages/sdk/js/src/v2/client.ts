export * from "./gen/types.gen.js"
export type { FileSystemEntry as LocationFileSystemEntry } from "./gen/types.gen.js"

import { createClient } from "./gen/client/client.gen.js"
import { type Config } from "./gen/client/types.gen.js"
import { OpencodeClient } from "./gen/sdk.gen.js"
import { wrapClientError } from "../error-interceptor.js"
export { type Config as OpencodeClientConfig, OpencodeClient }

export type ReviewHunk = { readonly id: string }
export type ReviewFile = { readonly id: string; readonly path: string; readonly hunks: readonly ReviewHunk[] }
export type ReviewRevision = { readonly id: string; readonly files: readonly ReviewFile[] }
export type ReviewMutation = {
  readonly operation: "accept" | "reject"
  readonly hunkIDs: readonly [string, ...string[]]
}

export type ReviewClient = {
  readonly capture: () => Promise<{ readonly data: ReviewRevision }>
  readonly mutate: (
    input: { readonly revisionID: string } & ReviewMutation,
  ) => Promise<{ readonly data: ReviewRevision }>
}

function pick(value: string | null, fallback?: string, encode?: (value: string) => string) {
  if (!value) return
  if (!fallback) return value
  if (value === fallback) return fallback
  if (encode && value === encode(fallback)) return fallback
  return value
}

function rewrite(request: Request, values: { directory?: string; workspace?: string }) {
  if (request.method !== "GET" && request.method !== "HEAD") return request

  const url = new URL(request.url)
  let changed = false

  for (const [name, key] of [
    ["x-opencode-directory", "directory"],
    ["x-opencode-workspace", "workspace"],
  ] as const) {
    const value = pick(
      request.headers.get(name),
      key === "directory" ? values.directory : values.workspace,
      key === "directory" ? encodeURIComponent : undefined,
    )
    if (!value) continue
    for (const query of url.pathname.startsWith("/api/") ? [key, `location[${key}]`] : [key]) {
      if (!url.searchParams.has(query)) {
        url.searchParams.set(query, value)
      }
    }
    changed = true
  }

  if (!changed) return request

  const next = new Request(url, request)
  next.headers.delete("x-opencode-directory")
  next.headers.delete("x-opencode-workspace")
  return next
}

export function createOpencodeClient(config?: Config & { directory?: string; experimental_workspaceID?: string }) {
  if (!config?.fetch) {
    const customFetch: any = (req: any) => {
      // @ts-ignore
      req.timeout = false
      return fetch(req)
    }
    config = {
      ...config,
      fetch: customFetch,
    }
  }

  if (config?.directory) {
    config.headers = {
      ...config.headers,
      "x-opencode-directory": encodeURIComponent(config.directory),
    }
  }

  if (config?.experimental_workspaceID) {
    config.headers = {
      ...config.headers,
      "x-opencode-workspace": config.experimental_workspaceID,
    }
  }

  const client = createClient(config)
  client.interceptors.request.use((request) =>
    rewrite(request, {
      directory: config?.directory,
      workspace: config?.experimental_workspaceID,
    }),
  )
  client.interceptors.response.use((response) => {
    const contentType = response.headers.get("content-type")
    if (contentType === "text/html")
      throw new Error("Request is not supported by this version of OpenCode Server (Server responded with text/html)")

    return response
  })
  client.interceptors.error.use(wrapClientError)
  return Object.assign(new OpencodeClient({ client }), { review: createReviewClient(config) })
}

function createReviewClient(
  config: (Config & { directory?: string; experimental_workspaceID?: string }) | undefined,
): ReviewClient {
  return {
    capture: () => requestReview(config, "/api/review"),
    mutate: (input) =>
      requestReview(config, `/api/review/${encodeURIComponent(input.revisionID)}`, {
        operation: input.operation,
        hunkIDs: input.hunkIDs,
      }),
  }
}

async function requestReview(
  config: (Config & { directory?: string; experimental_workspaceID?: string }) | undefined,
  pathname: string,
  body?: ReviewMutation,
): Promise<{ readonly data: ReviewRevision }> {
  const headers = reviewHeaders(config?.headers)
  if (body) headers.set("content-type", "application/json")
  const url = new URL(pathname, config?.baseUrl ?? "http://localhost")
  if (config?.directory) url.searchParams.set("location[directory]", config.directory)
  if (config?.experimental_workspaceID) url.searchParams.set("location[workspace]", config.experimental_workspaceID)
  const response = await (config?.fetch ?? globalThis.fetch)(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw new Error((await response.text()) || `Review request failed (${response.status})`)
  return { data: reviewRevision(await response.json()) }
}

function reviewRevision(value: unknown): ReviewRevision {
  const root = record(value)
  const data = record(root.data)
  const id = string(data.id)
  const files = Array.isArray(data.files) ? data.files.map(reviewFile) : undefined
  if (!id || !files) throw new Error("Invalid review response")
  return { id, files }
}

function reviewFile(value: unknown): ReviewFile {
  const input = record(value)
  const id = string(input.id)
  const path = string(input.path)
  const hunks = Array.isArray(input.hunks) ? input.hunks.map(reviewHunk) : undefined
  if (!id || !path || !hunks) throw new Error("Invalid review file")
  return { id, path, hunks }
}

function reviewHunk(value: unknown): ReviewHunk {
  const id = string(record(value).id)
  if (!id) throw new Error("Invalid review hunk")
  return { id }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value))
    return Object.fromEntries(Object.entries(value))
  throw new Error("Invalid review response")
}

function string(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function reviewHeaders(value: Config["headers"]) {
  const headers = new Headers()
  if (!value) return headers
  if (value instanceof Headers) {
    value.forEach((content, name) => headers.set(name, content))
    return headers
  }
  if (Array.isArray(value)) {
    value.forEach(([name, content]) => headers.set(name, content))
    return headers
  }
  Object.entries(value).forEach(([name, content]) => {
    if (typeof content === "string") headers.set(name, content)
  })
  return headers
}
