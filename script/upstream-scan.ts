/**
 * Reports what upstream has that this fork doesn't, split by whether it's worth caring
 * about. The fork deliberately does not track upstream — see README. Features and UI
 * churn over there are irrelevant to us, but provider/model definitions and auth do rot:
 * when a provider changes an API shape, a fork that never looks silently loses it.
 *
 *   bun run script/upstream-scan.ts
 */
import { $ } from "bun"
import { appendFileSync } from "node:fs"

/** Upstream changes here can break us; everything else is theirs to churn on. */
const WATCHED = ["packages/core", "packages/llm", "packages/protocol", "packages/sdk"]
const UPSTREAM = "upstream/dev"
const UPSTREAM_URL = "https://github.com/anomalyco/opencode.git"

// CI checkouts have no upstream remote, so add it rather than assuming a dev machine.
if (!(await $`git remote`.text()).split("\n").includes("upstream")) {
  await $`git remote add upstream ${UPSTREAM_URL}`.nothrow()
}
await $`git fetch upstream --quiet`.nothrow()

const commits = (await $`git log --oneline HEAD..${UPSTREAM}`.text()).trim().split("\n").filter(Boolean)
const watched = commits.length
  ? (await $`git log --oneline HEAD..${UPSTREAM} -- ${WATCHED}`.text()).trim().split("\n").filter(Boolean)
  : []

/** Commit subjects are upstream-authored, so keep them from breaking out of the code span. */
const clean = (line: string) => line.replaceAll("`", "'")

const report: string[] = []
if (!commits.length) {
  report.push("Up to date with upstream.")
} else {
  report.push(`${commits.length} commit(s) upstream we don't have.`, "")
  if (watched.length) {
    report.push(`**${watched.length} touch watched paths** (${WATCHED.join(", ")}):`, "")
    for (const line of watched) report.push(`- \`${clean(line)}\``)
    report.push("", "These are the ones that can break providers or auth.")
  } else {
    report.push(`None touch ${WATCHED.join(", ")} — nothing we need.`)
  }
  const rest = commits.filter((c) => !watched.includes(c))
  if (rest.length) {
    report.push("", `<details><summary>Everything else (${rest.length})</summary>`, "")
    for (const line of rest.slice(0, 40)) report.push(`- \`${clean(line)}\``)
    if (rest.length > 40) report.push(`- …and ${rest.length - 40} more`)
    report.push("", "</details>")
  }
}

const text = report.join("\n")
console.log(text)

// Surface the same report in the Actions run summary, and tell the workflow whether
// anything warrants an issue. These files are append-only contracts — overwriting them
// would drop whatever earlier steps wrote.
//
// The report goes to a file rather than GITHUB_ENV on purpose: it embeds upstream commit
// messages, and a message containing a lone `EOF` would escape a heredoc and let an
// upstream author set arbitrary environment variables in this job.
const emit = (name: string, body: string) => {
  const path = process.env[name]
  if (path) appendFileSync(path, body)
}
emit("GITHUB_STEP_SUMMARY", `## Upstream scan\n\n${text}\n`)

if (process.env.GITHUB_OUTPUT) {
  const reportPath = `${process.env.RUNNER_TEMP ?? "."}/upstream-scan.md`
  await Bun.write(reportPath, `${text}\n`)
  emit("GITHUB_OUTPUT", `watched=${watched.length}\nreport=${reportPath}\n`)
}
