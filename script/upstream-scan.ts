/**
 * Warns early when Rig falls behind upstream. Two questions, both answered fresh on every run:
 *
 * - How far behind is Rig? Upstream's newest stable release against the root `package.json` `upstreamBase`, plus
 *   the files both sides changed since that base: those are the next merge's conflicts.
 * - Does Zen still serve Rig free models? One tiny free-model request that identifies as Rig's build. Zen gates free
 *   models on the client version, and that gate is what forced the move to 2.x.
 *
 * Locally it only prints the report. In GitHub Actions it also keeps one rolling issue whose body is the latest
 * report. Body edits notify nobody, so anything worth an alert is a comment: Zen refusing Rig, and a weekly digest
 * on Mondays (or a manual run) while Rig is behind.
 *
 *   bun run upstream:scan
 */
import { $ } from "bun"
import { appendFileSync } from "node:fs"
import path from "node:path"

const UPSTREAM_URL = "https://github.com/anomalyco/opencode.git"
const ZEN_URL = "https://opencode.ai/inference/openai/v1/chat/completions"
const ZEN_MODEL = "deepseek-v4.1-flash-free"
const LABEL = "upstream-scan"
// Kept out of `refs/tags`, so upstream's tags can never collide with the fork's own release tags.
const BASE_REF = "refs/upstream-scan/base"
const LATEST_REF = "refs/upstream-scan/latest"

const base: string = (await Bun.file(path.resolve(import.meta.dir, "../package.json")).json()).upstreamBase

// CI checkouts have no upstream remote.
if (!(await $`git remote`.text()).split("\n").includes("upstream")) await $`git remote add upstream ${UPSTREAM_URL}`
const releases = (await $`git ls-remote --tags --refs upstream`.text())
  .split("\n")
  .map((line) => line.split("refs/tags/v")[1])
  .filter((version): version is string => /^\d+\.\d+\.\d+$/.test(version ?? ""))
  .sort(Bun.semver.order)
const latest = releases.at(-1) ?? base
const behind = releases.filter((version) => Bun.semver.order(version, base) > 0)
await $`git fetch upstream +refs/tags/v${base}:${BASE_REF} +refs/tags/v${latest}:${LATEST_REF} --no-tags --quiet`

const ours = (await $`git diff --name-only ${BASE_REF} HEAD`.text())
  .split("\n")
  .filter((file) => file && file !== "bun.lock")
const overlap = ours.length
  ? (await $`git diff --name-only ${BASE_REF} ${LATEST_REF} -- ${ours}`.text()).split("\n").filter(Boolean)
  : []
const commits = overlap.length
  ? (await $`git log --format=${"%h %s"} ${BASE_REF}..${LATEST_REF} -- ${overlap}`.text()).split("\n").filter(Boolean)
  : []

const zen = await probeZen()

/** Commit subjects are upstream-authored, so keep them from breaking out of the code span. */
const list = (lines: string[], cap = 40) => [
  ...lines.slice(0, cap).map((line) => `- \`${line.replaceAll("`", "'")}\``),
  ...(lines.length > cap ? [`- …and ${lines.length - cap} more`] : []),
]
const headline = [
  zen.state === "refused" ? "**Zen refuses Rig's free models.**" : undefined,
  behind.length
    ? `Upstream is at **v${latest}**; Rig is based on v${base}, ${behind.length} release(s) behind.`
    : `Rig is on upstream's latest release (v${base}).`,
]
  .filter(Boolean)
  .join(" ")
const report = [
  headline,
  "",
  "## Zen free models",
  {
    served: `Served Rig's version (\`opencode/latest/${base}/desktop\`).`,
    refused: `Refused Rig's version (\`opencode/latest/${base}/desktop\`), HTTP ${zen.status}: ${zen.message}`,
    unknown: `Could not tell, HTTP ${zen.status}: ${zen.message}. Zen checks the free-usage limit before the version.`,
  }[zen.state],
  ...(behind.length
    ? [
        "",
        "## Next merge",
        overlap.length
          ? `${overlap.length} file(s) changed by both Rig and upstream since v${base}, in ${commits.length} upstream commit(s):`
          : `No file Rig changed was touched upstream since v${base}; the merge should be clean.`,
        ...(overlap.length ? ["", "<details><summary>Files</summary>", "", ...list(overlap), "", "</details>"] : []),
        ...(commits.length ? ["", "<details><summary>Commits</summary>", "", ...list(commits), "", "</details>"] : []),
      ]
    : []),
].join("\n")

console.log(report)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `# Upstream scan\n\n${report}\n`)
if (process.env.GITHUB_ACTIONS === "true") await publish()

/** Asks for one token as Rig's build does. Zen answers a refused version with "no longer supports free models". */
async function probeZen() {
  const response = await fetch(ZEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer public",
      "Content-Type": "application/json",
      "User-Agent": `opencode/latest/${base}/desktop`,
      "x-opencode-client": "desktop",
    },
    body: JSON.stringify({ model: ZEN_MODEL, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    signal: AbortSignal.timeout(60_000),
  }).then(
    async (result) => ({ status: result.status, text: await result.text() }),
    (error: Error) => ({ status: 0, text: error.message }),
  )
  const message = (response.text.match(/"message"\s*:\s*"([^"]*)"/)?.[1] ?? response.text).slice(0, 300)
  if (response.status === 200) return { state: "served" as const, status: response.status, message }
  if (/no longer supports free models/i.test(response.text))
    return { state: "refused" as const, status: response.status, message }
  return { state: "unknown" as const, status: response.status, message }
}

/** Keeps the rolling issue current. `gh` reads the repository from `GH_REPO`, never from the `upstream` remote. */
async function publish() {
  const marker = `<!-- zen:${zen.state} -->`
  const file = path.join(process.env.RUNNER_TEMP ?? ".", "upstream-scan.md")
  const run = `${process.env.GITHUB_SERVER_URL}/${process.env.GH_REPO}/actions/runs/${process.env.GITHUB_RUN_ID}`
  await Bun.write(file, `${report}\n\n— [upstream-scan](${run}) · \`bun run upstream:scan\` locally.\n${marker}\n`)

  await $`gh label create ${LABEL} --color ededed --description ${"Rig is behind upstream or Zen refuses it"} --force`
  const open = JSON.parse(
    await $`gh issue list --state open --label ${LABEL} --limit 1 --json number,body`.text(),
  )[0] as { number: number; body: string } | undefined
  const newlyRefused = zen.state === "refused" && !open?.body.includes("<!-- zen:refused -->")
  const digest = process.env.GITHUB_EVENT_NAME === "workflow_dispatch" || new Date().getUTCDay() === 1

  if (!behind.length && zen.state !== "refused") {
    if (open) await $`gh issue close ${open.number} --comment ${headline}`
    return
  }
  if (!open) {
    await $`gh issue create --title ${"Upstream scan"} --label ${LABEL} --body-file ${file}`
    return
  }
  await $`gh issue edit ${open.number} --body-file ${file}`
  if (newlyRefused || digest) await $`gh issue comment ${open.number} --body ${headline}`
}
