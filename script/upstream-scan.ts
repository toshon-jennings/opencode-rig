/**
 * Reports what NEW upstream activity has landed in watched paths since the last scan.
 * The fork deliberately does not track upstream — see README. Features and UI churn
 * over there are irrelevant to us, but provider/model definitions and auth do rot: when
 * a provider changes an API shape, a fork that never looks silently loses it.
 *
 * Diffing against the fork's own HEAD would be wrong: since this fork never merges
 * upstream, that gap only grows, and the same commits would get reported forever. A
 * moving `upstream-scan-cursor` tag tracks what's already been reported, so each run
 * only surfaces what's actually new. Local runs never move it — only a run inside GitHub
 * Actions does, so an idle local check-in can't silently suppress the automated backstop.
 *
 * The cursor tag points at the fork's own HEAD, never at the upstream commit it's
 * tracking — the upstream SHA lives in the tag's *message* instead. Tagging the upstream
 * commit directly would, on push, transfer that commit's full ancestry (this fork has
 * only ever fetched it, never pushed it), which includes upstream's own edits to their
 * own workflow files — and GitHub's default token refuses any push that introduces
 * workflow-file content without an explicit `workflows` grant. Pointing at HEAD avoids
 * shipping a slice of upstream's real history into this repo just to remember a SHA.
 *
 *   bun run script/upstream-scan.ts
 */
import { $ } from "bun"
import { appendFileSync } from "node:fs"

/** Upstream changes here can break us; everything else is theirs to churn on. */
const WATCHED = ["packages/core", "packages/llm", "packages/protocol", "packages/sdk"]
const UPSTREAM = "upstream/dev"
const UPSTREAM_URL = "https://github.com/anomalyco/opencode.git"
const CURSOR_TAG = "upstream-scan-cursor"

// CI checkouts have no upstream remote, so add it rather than assuming a dev machine.
if (!(await $`git remote`.text()).split("\n").includes("upstream")) {
  await $`git remote add upstream ${UPSTREAM_URL}`.nothrow()
}
await $`git fetch upstream --quiet`.nothrow()

// The cursor tag lives on this fork's own remote, whatever it's called locally (`rig`)
// or in Actions (`origin`) — so try every remote except upstream rather than hardcoding one.
const remotes = (await $`git remote`.text()).trim().split("\n").filter((r) => r && r !== "upstream")
for (const remote of remotes) {
  await $`git fetch ${remote} refs/tags/${CURSOR_TAG}:refs/tags/${CURSOR_TAG} --quiet`.nothrow().quiet()
}
// The upstream SHA is the tag's message, not its target — see the header comment.
// The format string is passed as an interpolated value, not written literally in the
// template: Bun Shell parses the template itself before exec, and unescaped parens in
// `%(contents)` are invalid syntax to ITS parser, not just the OS shell's.
const CONTENTS_FORMAT = "%(contents)"
const cursor =
  (await $`git for-each-ref refs/tags/${CURSOR_TAG} --format=${CONTENTS_FORMAT}`.nothrow().text()).trim() || undefined

const commits = (await $`git log --oneline HEAD..${UPSTREAM}`.text()).trim().split("\n").filter(Boolean)
const watchedTotal = commits.length
  ? (await $`git log --oneline HEAD..${UPSTREAM} -- ${WATCHED}`.text()).trim().split("\n").filter(Boolean)
  : []
// The actionable set: only what's landed since the last time a scan actually ran,
// not the fork's entire permanent (and permanently growing) backlog vs its own HEAD.
const watchedNew = cursor
  ? (await $`git log --oneline ${cursor}..${UPSTREAM} -- ${WATCHED}`.text()).trim().split("\n").filter(Boolean)
  : watchedTotal

/** Commit subjects are upstream-authored, so keep them from breaking out of the code span. */
const clean = (line: string) => line.replaceAll("`", "'")
const list = (lines: string[], cap = 40) => [
  ...lines.slice(0, cap).map((l) => `- \`${clean(l)}\``),
  ...(lines.length > cap ? [`- …and ${lines.length - cap} more`] : []),
]

const report: string[] = []
if (!cursor) {
  report.push(
    "No prior scan found — establishing a baseline instead of reporting the full historical backlog.",
    "",
    `${watchedTotal.length} watched-path commit(s) already outstanding as of now; only NEW activity from here gets reported.`,
  )
} else if (!watchedNew.length) {
  report.push(`Up to date on watched paths (${WATCHED.join(", ")}) since the last scan.`)
  if (watchedTotal.length) {
    report.push("", `(${watchedTotal.length} unrelated-path commit(s) still outstanding overall — not shown, not actionable.)`)
  }
} else {
  report.push(`**${watchedNew.length} new commit(s) touching watched paths** (${WATCHED.join(", ")}) since the last scan:`, "")
  report.push(...list(watchedNew))
  report.push("", "These are the ones that can break providers or auth.")
  if (watchedTotal.length > watchedNew.length) {
    report.push("", `<details><summary>Also still outstanding from before (${watchedTotal.length - watchedNew.length})</summary>`, "")
    report.push(...list(watchedTotal.filter((c) => !watchedNew.includes(c))))
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
  emit("GITHUB_OUTPUT", `watched=${cursor ? watchedNew.length : 0}\nreport=${reportPath}\n`)
}

// Only a run inside GitHub Actions moves the cursor — scheduled or a manual dispatch
// from the Actions UI both count as "the tracked channel checked in." A local
// `bun run upstream:scan` stays read-only so an idle peek can't silently mark
// tomorrow's real check as "already seen."
if (process.env.GITHUB_ACTIONS === "true") {
  const upstreamHead = (await $`git rev-parse ${UPSTREAM}`.text()).trim()
  await $`git tag -f -a ${CURSOR_TAG} -m ${upstreamHead} HEAD`.quiet()
  await $`git push origin refs/tags/${CURSOR_TAG} --force`.quiet()
}
