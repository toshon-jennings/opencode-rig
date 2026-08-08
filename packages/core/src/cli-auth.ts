export * as CliAuth from "./cli-auth"

import { homedir } from "node:os"
import path from "node:path"

type CommandCodeModel = {
  id: string
  name?: string
  context_length?: number
}

export const commandCodeFallbackModels = [
  { id: "claude-sonnet-5", name: "Claude Sonnet 5", context_length: 1_000_000 },
  { id: "claude-fable-5", name: "Claude Fable 5", context_length: 1_000_000 },
  { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", context_length: 400_000 },
  { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", context_length: 400_000 },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", context_length: 400_000 },
  { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", context_length: 1_000_000 },
  { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", context_length: 256_000 },
] satisfies CommandCodeModel[]

async function output(command: string, args: string[]) {
  for (const executable of await executables(command)) {
    const process = Bun.spawn([executable, ...args], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      timeout: 3000,
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ])
    if (code === 0) return stdout.trim() || stderr.trim() || undefined
  }
}

export async function executable(command: string, args = ["--version"]) {
  for (const candidate of await executables(command)) {
    const process = Bun.spawn([candidate, ...args], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      timeout: 3000,
    })
    if ((await process.exited) === 0) return candidate
  }
}

async function executables(command: string) {
  const candidates = [
    Bun.which(command),
    ...(process.env.PATH ?? "").split(path.delimiter).map((directory) => path.join(directory, command)),
  ].filter((item): item is string => Boolean(item))
  const unique = [...new Set(candidates)]
  const exists = await Promise.all(unique.map((item) => Bun.file(item).exists()))
  return unique.filter((_, index) => exists[index])
}

export async function commandCodeKey() {
  if (process.env.COMMAND_CODE_API_KEY) return process.env.COMMAND_CODE_API_KEY
  const value = await Bun.file(`${homedir()}/.commandcode/auth.json`)
    .json()
    .catch(() => undefined)
  if (!value || typeof value !== "object" || !("apiKey" in value) || typeof value.apiKey !== "string") return
  return value.apiKey
}

export async function commandCodeModels(input?: string) {
  const key = input ?? (await commandCodeKey())
  if (!key) return []
  const response = await fetch("https://api.commandcode.ai/provider/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined)
  if (!response?.ok) return []
  const value = (await response.json().catch(() => undefined)) as { data?: unknown } | undefined
  if (!Array.isArray(value?.data)) return []
  return value.data.filter(
    (item): item is CommandCodeModel =>
      Boolean(item) &&
      typeof item === "object" &&
      "id" in item &&
      typeof item.id === "string" &&
      (!("name" in item) || item.name === undefined || typeof item.name === "string") &&
      (!("context_length" in item) ||
        item.context_length === undefined ||
        (typeof item.context_length === "number" && Number.isSafeInteger(item.context_length))),
  )
}

export async function copilotToken() {
  for (const name of ["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"]) {
    if (process.env[name]) return process.env[name]
  }
  if (process.platform === "darwin") {
    const keychain = await output("security", ["find-generic-password", "-s", "copilot-cli", "-w"])
    if (keychain) return keychain
  }
  return output("gh", ["auth", "token"])
}

export async function codexLoggedIn() {
  return (await output("codex", ["login", "status"]))?.includes("Logged in") ?? false
}

export async function claudeLoggedIn() {
  const status = await output("claude", ["auth", "status", "--json"])
  if (!status) return false
  const value = await new Response(status).json().catch(() => undefined)
  return Boolean(value && typeof value === "object" && "loggedIn" in value && value.loggedIn === true)
}
