import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from "@ai-sdk/provider"
import { CliAuth } from "./cli-auth"

type Backend = (input: { model: string; prompt: string; abortSignal?: AbortSignal }) => AsyncIterable<string>

const usage: LanguageModelV3Usage = {
  inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: undefined, text: undefined, reasoning: undefined },
}

export function createCliAgentLanguageModel(provider: string, model: string, backend: Backend): LanguageModelV3 {
  const run = (options: LanguageModelV3CallOptions) =>
    backend({ model, prompt: serializePrompt(options.prompt), abortSignal: options.abortSignal })

  return {
    specificationVersion: "v3",
    provider,
    modelId: model,
    supportedUrls: {},
    async doGenerate(options) {
      const chunks: string[] = []
      for await (const chunk of run(options)) chunks.push(chunk)
      return {
        content: [{ type: "text", text: chunks.join("") }],
        finishReason: { unified: "stop", raw: "stop" },
        usage,
        warnings: [],
      }
    },
    async doStream(options) {
      const id = crypto.randomUUID()
      return {
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          async start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] })
            controller.enqueue({ type: "text-start", id })
            try {
              for await (const delta of run(options)) controller.enqueue({ type: "text-delta", id, delta })
              controller.enqueue({ type: "text-end", id })
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop", raw: "stop" },
                usage,
              })
              controller.close()
            } catch (error) {
              controller.enqueue({ type: "error", error })
              controller.close()
            }
          },
        }),
      }
    },
  }
}

export function createCliAgentProvider(options: { name?: string } = {}) {
  const provider = options.name === "codex-cli" ? "codex-cli" : "claude-cli"
  const backend = provider === "codex-cli" ? runCodexAppServer : runClaudeAgent
  return {
    languageModel: (model: string) => createCliAgentLanguageModel(provider, model, backend),
  }
}

export async function* runClaudeAgent(input: { model: string; prompt: string; abortSignal?: AbortSignal }) {
  const executable = await CliAuth.executable("claude", ["auth", "status", "--json"])
  if (!executable) throw new Error("Claude CLI is not installed")
  const child = Bun.spawn(
    [
      executable,
      "--print",
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--verbose",
      "--no-session-persistence",
      "--safe-mode",
      "--permission-mode",
      "plan",
      "--tools",
      "",
      "--model",
      input.model,
      input.prompt,
    ],
    { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
  )
  const abort = () => child.kill()
  input.abortSignal?.addEventListener("abort", abort, { once: true })
  const errors = new Response(child.stderr).text()
  try {
    for await (const line of lines(child.stdout)) {
      const event = parse(line)
      if (!event || event.type !== "stream_event" || typeof event.event !== "object" || !event.event) continue
      if (!("type" in event.event) || event.event.type !== "content_block_delta") continue
      if (!("delta" in event.event) || typeof event.event.delta !== "object" || !event.event.delta) continue
      if (!("type" in event.event.delta) || event.event.delta.type !== "text_delta") continue
      if (!("text" in event.event.delta) || typeof event.event.delta.text !== "string") continue
      yield event.event.delta.text
    }
    const code = await child.exited
    if (code !== 0) throw new Error((await errors).trim() || `Claude CLI exited with code ${code}`)
  } finally {
    input.abortSignal?.removeEventListener("abort", abort)
  }
}

export async function* runCodexAppServer(input: { model: string; prompt: string; abortSignal?: AbortSignal }) {
  const executable = await CliAuth.executable("codex", ["login", "status"])
  if (!executable) throw new Error("Codex CLI is not installed")
  const child = Bun.spawn([executable, "app-server"], { stdin: "pipe", stdout: "pipe", stderr: "pipe" })
  const abort = () => child.kill()
  input.abortSignal?.addEventListener("abort", abort, { once: true })
  const errors = new Response(child.stderr).text()
  const stream = lines(child.stdout)[Symbol.asyncIterator]()
  const send = (message: unknown) => {
    child.stdin.write(`${JSON.stringify(message)}\n`)
    child.stdin.flush()
  }
  try {
    send({
      method: "initialize",
      id: 1,
      params: { clientInfo: { name: "opencode_rig", title: "OpenCode Rig", version: "0.1.0" } },
    })
    await response(stream, 1)
    send({ method: "initialized", params: {} })
    send({
      method: "thread/start",
      id: 2,
      params: {
        model: input.model,
        cwd: process.cwd(),
        approvalPolicy: "never",
        sandbox: "read-only",
        ephemeral: true,
      },
    })
    const started = await response(stream, 2)
    const thread = value(started, "result", "thread", "id")
    if (typeof thread !== "string") throw new Error("Codex app-server did not return a thread ID")
    send({
      method: "turn/start",
      id: 3,
      params: { threadId: thread, input: [{ type: "text", text: input.prompt }] },
    })
    for await (const line of remaining(stream)) {
      const event = parse(line)
      if (!event) continue
      if (event.method === "item/agentMessage/delta") {
        const delta = value(event, "params", "delta")
        if (typeof delta === "string") yield delta
      }
      if (event.method === "turn/completed") return
      if (event.id !== undefined && typeof event.method === "string") {
        send({ id: event.id, error: { code: -32601, message: "OpenCode Rig does not handle this request" } })
      }
    }
    const code = await child.exited
    if (code !== 0) throw new Error((await errors).trim() || `Codex app-server exited with code ${code}`)
    throw new Error("Codex app-server ended before the turn completed")
  } finally {
    input.abortSignal?.removeEventListener("abort", abort)
    child.kill()
  }
}

function serializePrompt(prompt: LanguageModelV3Prompt) {
  return prompt
    .map((message) => {
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content
              .map((part) => {
                if (part.type === "text" || part.type === "reasoning") return part.text
                if (part.type === "tool-call") return `Tool call ${part.toolName}: ${JSON.stringify(part.input)}`
                if (part.type === "tool-result") return `Tool result ${part.toolName}: ${JSON.stringify(part.output)}`
                if (part.type === "file")
                  return `[Attached ${part.mediaType}${part.filename ? `: ${part.filename}` : ""}]`
                if (part.type === "tool-approval-response") {
                  return `Tool approval ${part.approvalId}: ${part.approved ? "approved" : "denied"}`
                }
                return ""
              })
              .filter(Boolean)
              .join("\n")
      return `<${message.role}>\n${content}\n</${message.role}>`
    })
    .join("\n\n")
}

async function* lines(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let pending = ""
  while (true) {
    const part = await reader.read()
    if (part.done) break
    pending += decoder.decode(part.value, { stream: true })
    const split = pending.split("\n")
    pending = split.pop() ?? ""
    for (const line of split) if (line.trim()) yield line
  }
  pending += decoder.decode()
  if (pending.trim()) yield pending
}

async function* remaining(stream: AsyncIterator<string>) {
  while (true) {
    const item = await stream.next()
    if (item.done) return
    yield item.value
  }
}

async function response(stream: AsyncIterator<string>, id: number) {
  for await (const line of remaining(stream)) {
    const message = parse(line)
    if (!message || message.id !== id) continue
    if (message.error) throw new Error(JSON.stringify(message.error))
    return message
  }
  throw new Error(`App-server ended before response ${id}`)
}

function parse(line: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(line)
    return value && typeof value === "object" ? value : undefined
  } catch {
    return
  }
}

function value(input: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || !(key in current)) return
    return current[key as keyof typeof current]
  }, input)
}
