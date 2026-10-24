import { expect, test } from "bun:test"
import { mkdtemp, writeFile, chmod, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

test("CLI discovery and execution work under Node with subscription credentials", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "rig-cli-node-"))
  const fixture = path.join(dir, "cli.cjs")
  await writeFile(
    fixture,
    `#!/usr/bin/env node
const readline = require("node:readline")
const args = process.argv.slice(2)
if (args[0] === "--version") console.log("fixture CLI")
else if (args[0] === "login") console.log("Logged in using ChatGPT")
else if (args[0] === "auth") console.log(JSON.stringify({ loggedIn: !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN }))
else if (args[0] === "--print") {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) process.exit(1)
  if (args.includes("--permission-mode") || args[args.indexOf("--tools") + 1] !== "") process.exit(2)
  if (require("node:fs").readFileSync(0, "utf8") !== "test") process.exit(3)
  const system = args[args.indexOf("--system-prompt-file") + 1]
  if (require("node:fs").readFileSync(system, "utf8") !== "Fixture instructions".repeat(20000)) process.exit(4)
  if ((require("node:fs").statSync(system).mode & 0o777) !== 0o600) process.exit(5)
  console.log(JSON.stringify({type:"stream_event",event:{type:"content_block_delta",delta:{type:"text_delta",text:"Claude OK"}}}))
} else if (args[0] === "app-server") {
  readline.createInterface({input:process.stdin}).on("line", (line) => {
    const message = JSON.parse(line)
    if (message.id) console.log(JSON.stringify({id:message.id,result:message.method === "thread/start" ? {thread:{id:"fixture"}} : {}}))
    if (message.method === "turn/start") {
      console.log(JSON.stringify({method:"item/agentMessage/delta",params:{delta:"Codex OK"}}))
      console.log(JSON.stringify({method:"turn/completed"}))
    }
  })
}
`,
  )
  await chmod(fixture, 0o755)
  await symlink(fixture, path.join(dir, "claude"))
  await symlink(fixture, path.join(dir, "codex"))
  const entry = path.join(dir, "entry.ts")
  await writeFile(
    entry,
    `
import { CliAuth } from ${JSON.stringify(path.resolve(import.meta.dir, "../src/cli-auth.ts"))}
import { runClaudeAgent, runCodexAppServer } from ${JSON.stringify(path.resolve(import.meta.dir, "../src/cli-agent-language-model.ts"))}
const results = { bun: typeof Bun, claude: await CliAuth.claudeLoggedIn(), codex: await CliAuth.codexLoggedIn(), key: await CliAuth.commandCodeKey(), texts: [] }
for (const backend of [runClaudeAgent, runCodexAppServer]) {
  let result = ""
  for await (const chunk of backend({model:"fixture",prompt:"test",system:"Fixture instructions".repeat(20000)})) result += chunk
  results.texts.push(result)
}
console.log(JSON.stringify(results))
`,
  )
  const build = await Bun.build({ entrypoints: [entry], target: "node", outdir: dir })
  expect(build.success).toBe(true)
  const child = Bun.spawn([Bun.which("node")!, path.join(dir, "entry.js")], {
    env: {
      ...process.env,
      PATH: `${dir}${path.delimiter}${process.env.PATH}`,
      ANTHROPIC_API_KEY: "fixture-api-key",
      ANTHROPIC_AUTH_TOKEN: "fixture-auth-token",
      COMMAND_CODE_API_KEY: "fixture-command-code-key",
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  expect(stderr).toBe("")
  expect(code).toBe(0)
  expect(JSON.parse(stdout)).toEqual({
    bun: "undefined",
    claude: true,
    codex: true,
    key: "fixture-command-code-key",
    texts: ["Claude OK", "Codex OK"],
  })
}, 30_000)
