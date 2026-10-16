export * as GithubOverview from "./github-overview"

import { Context, Effect, Layer } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import { GithubOverview as Schema } from "@opencode-ai/schema/github-overview"
import { makeLocationNode } from "./effect/app-node"
import { httpClient } from "./effect/app-node-platform"
import { Git } from "./git"
import { Location } from "./location"

export interface Interface {
  readonly overview: () => Effect.Effect<Schema.Overview>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/GithubOverview") {}

const GITHUB_API = "https://api.github.com"
const COMMITS_LIMIT = 10
const RUNS_LIMIT = 10
const ISSUES_LIMIT = 20
const PULLS_LIMIT = 20
const FETCH_TIMEOUT = "15 seconds" as const

const token = () => process.env["GITHUB_TOKEN"] || process.env["GH_TOKEN"] || undefined

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const git = yield* Git.Service
    const location = yield* Location.Service
    const http = yield* HttpClient.HttpClient

    const requestFor = (url: string, auth: string | undefined) => {
      const request = HttpClientRequest.get(`${GITHUB_API}${url}`).pipe(
        HttpClientRequest.setHeaders({
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "opencode-github-overview",
        }),
      )
      return auth ? request.pipe(HttpClientRequest.setHeader("Authorization", `Bearer ${auth}`)) : request
    }

    type FetchResult = { status: number; message: string | undefined; json: unknown }

    const failed = (message: string, status = 0): FetchResult => ({ status, message, json: undefined })

    const getJson = Effect.fn("GithubOverview.getJson")(function* (url: string, auth: string | undefined) {
      const result = yield* Effect.gen(function* () {
        const response = yield* http.execute(requestFor(url, auth)).pipe(Effect.timeout(FETCH_TIMEOUT))
        if (response.status === 429 || response.headers["x-ratelimit-remaining"] === "0") {
          return failed("GitHub API rate limit exceeded", response.status)
        }
        if (response.status === 404) {
          return failed("GitHub resource not found", response.status)
        }
        if (response.status === 403) {
          return failed("GitHub API access forbidden for this resource", response.status)
        }
        if (response.status >= 400) {
          return failed(`GitHub API error ${response.status}`, response.status)
        }
        const json: unknown = yield* response.json
        return { status: response.status, message: undefined as string | undefined, json } satisfies FetchResult
      }).pipe(Effect.catch(() => Effect.succeed(failed("GitHub request failed"))))
      return result
    })

    const fetchMeta = (remote: Schema.Remote, auth: string | undefined) =>
      Effect.gen(function* () {
        const result = yield* getJson(`/repos/${remote.owner}/${remote.repo}`, auth)
        const json = result.json
        if (!isRecord(json)) return { item: undefined as Schema.RepoMeta | undefined, error: result.message }
        return {
          item: {
            description: typeof json["description"] === "string" ? json["description"] : undefined,
            stars: toCount(json["stargazers_count"]),
            forks: toCount(json["forks_count"]),
            openIssues: toCount(json["open_issues_count"]),
            language: typeof json["language"] === "string" ? json["language"] : undefined,
          } satisfies Schema.RepoMeta,
          error: result.message,
        }
      })

    const fetchCommits = (remote: Schema.Remote, auth: string | undefined) =>
      Effect.gen(function* () {
        const result = yield* getJson(`/repos/${remote.owner}/${remote.repo}/commits?per_page=${COMMITS_LIMIT}`, auth)
        const items = asArray(result.json).flatMap((entry) => {
          if (!isRecord(entry)) return []
          const sha = typeof entry["sha"] === "string" ? entry["sha"] : undefined
          const commit = isRecord(entry["commit"]) ? entry["commit"] : undefined
          const message =
            commit && typeof commit["message"] === "string" ? commit["message"].split("\n")[0] : undefined
          const author =
            commit && isRecord(commit["author"]) && typeof commit["author"]["name"] === "string"
              ? commit["author"]["name"]
              : undefined
          const committedAt =
            commit && isRecord(commit["committer"]) && typeof commit["committer"]["date"] === "string"
              ? commit["committer"]["date"]
              : undefined
          const htmlUrl = typeof entry["html_url"] === "string" ? entry["html_url"] : undefined
          if (!sha || !message || !author || !committedAt) return []
          return [{ sha, message, author, committedAt, htmlUrl } satisfies Schema.Commit]
        })
        return { items: result.json === undefined ? undefined : items, error: result.message }
      })

    const fetchRuns = (remote: Schema.Remote, auth: string | undefined) =>
      Effect.gen(function* () {
        const result = yield* getJson(`/repos/${remote.owner}/${remote.repo}/actions/runs?per_page=${RUNS_LIMIT}`, auth)
        const runs = isRecord(result.json) ? asArray(result.json["workflow_runs"]) : []
        const items = runs.flatMap((entry) => {
          if (!isRecord(entry)) return []
          const workflowName = typeof entry["name"] === "string" ? entry["name"] : undefined
          const status = typeof entry["status"] === "string" ? entry["status"] : undefined
          const conclusion = typeof entry["conclusion"] === "string" ? entry["conclusion"] : undefined
          const runNumber = typeof entry["run_number"] === "number" ? entry["run_number"] : undefined
          const branch = typeof entry["head_branch"] === "string" ? entry["head_branch"] : undefined
          const htmlUrl = typeof entry["html_url"] === "string" ? entry["html_url"] : undefined
          const updatedAt = typeof entry["updated_at"] === "string" ? entry["updated_at"] : undefined
          if (!workflowName || !status || runNumber === undefined || !branch || !htmlUrl || !updatedAt) return []
          return [
            {
              workflowName,
              status,
              conclusion: isConclusion(conclusion) ? conclusion : undefined,
              runNumber,
              branch,
              htmlUrl,
              updatedAt,
            } satisfies Schema.Run,
          ]
        })
        return { items: result.json === undefined ? undefined : items, error: result.message }
      })

    const fetchIssues = (remote: Schema.Remote, auth: string | undefined) =>
      Effect.gen(function* () {
        const result = yield* getJson(
          `/repos/${remote.owner}/${remote.repo}/issues?state=open&per_page=${ISSUES_LIMIT}`,
          auth,
        )
        const items = asArray(result.json).flatMap((entry) => {
          if (!isRecord(entry) || entry["pull_request"]) return []
          return toIssue(entry)
        })
        return { items: result.json === undefined ? undefined : items, error: result.message }
      })

    const fetchPulls = (remote: Schema.Remote, auth: string | undefined) =>
      Effect.gen(function* () {
        const result = yield* getJson(`/repos/${remote.owner}/${remote.repo}/pulls?state=open&per_page=${PULLS_LIMIT}`, auth)
        const items = asArray(result.json).flatMap((entry) => {
          if (!isRecord(entry)) return []
          const number = typeof entry["number"] === "number" ? entry["number"] : undefined
          const title = typeof entry["title"] === "string" ? entry["title"] : undefined
          const user =
            isRecord(entry["user"]) && typeof entry["user"]["login"] === "string" ? entry["user"]["login"] : undefined
          const htmlUrl = typeof entry["html_url"] === "string" ? entry["html_url"] : undefined
          const createdAt = typeof entry["created_at"] === "string" ? entry["created_at"] : undefined
          const updatedAt = typeof entry["updated_at"] === "string" ? entry["updated_at"] : undefined
          if (number === undefined || !title || !user || !htmlUrl || !createdAt || !updatedAt) return []
          return [
            {
              number,
              title,
              author: user,
              draft: entry["draft"] === true,
              htmlUrl,
              createdAt,
              updatedAt,
            } satisfies Schema.PullRequest,
          ]
        })
        return { items: result.json === undefined ? undefined : items, error: result.message }
      })

    const resolveDeps = (remote: Schema.Remote, auth: string | undefined, updatePRs: number) =>
      Effect.gen(function* () {
        const result = yield* getJson(
          `/repos/${remote.owner}/${remote.repo}/dependabot/alerts?state=open&per_page=100`,
          auth,
        )
        if (result.json === undefined || result.status === 403 || result.status === 404) {
          return {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            updatePRs,
            alertsAvailable: false,
          } satisfies Schema.DependencySummary
        }
        const counts = { critical: 0, high: 0, medium: 0, low: 0 }
        for (const entry of asArray(result.json)) {
          if (!isRecord(entry) || !isRecord(entry["security_advisory"])) continue
          const severity = entry["security_advisory"]["severity"]
          if (severity === "critical" || severity === "high" || severity === "medium" || severity === "low") {
            counts[severity]++
          }
        }
        return { ...counts, updatePRs, alertsAvailable: true } satisfies Schema.DependencySummary
      })

    const remoteUrlFor = Effect.fn("GithubOverview.remoteUrl")(function* (repository: Git.Repository) {
      const origin = yield* git.remote.get(repository)
      if (origin) return origin
      return yield* git.remote.get(repository, "upstream")
    })

    const overview = Effect.fn("GithubOverview.overview")(function* () {
      const auth = token()
      const repository = yield* git.repo.discover(location.project.directory)
      if (!repository) return { isRepo: false, commits: [], tokenConfigured: !!auth } satisfies Schema.Overview

      const [branch, defaultBranch, summary, distance, log, remoteUrl] = yield* Effect.all(
        [
          git.history.branch(repository),
          git.history.defaultRemoteBranch(repository),
          git.status.summary(repository),
          git.status.aheadBehind(repository),
          git.status.recentCommits(repository, COMMITS_LIMIT),
          remoteUrlFor(repository),
        ],
        { concurrency: 6 },
      )
      const remote = remoteUrl ? parseGitHubRemote(remoteUrl) : undefined
      const local = {
        branch,
        defaultBranch,
        staged: summary.staged,
        unstaged: summary.unstaged,
        untracked: summary.untracked,
        ahead: distance.ahead,
        behind: distance.behind,
      } satisfies Schema.LocalWork
      const commits = log.map((commit) => ({
        ...commit,
        htmlUrl: remote ? `${remote.htmlUrl}/commit/${commit.sha}` : undefined,
      }))

      if (!remote) {
        return {
          isRepo: true,
          local,
          commits,
          tokenConfigured: !!auth,
        } satisfies Schema.Overview
      }

      const [meta, remoteCommits, runs, issues, pulls] = yield* Effect.all(
        [
          fetchMeta(remote, auth),
          fetchCommits(remote, auth),
          fetchRuns(remote, auth),
          fetchIssues(remote, auth),
          fetchPulls(remote, auth),
        ],
        { concurrency: 5 },
      )
      const botPRs = (pulls.items ?? []).filter((pull) => isBotAuthor(pull.author)).length
      const deps = yield* resolveDeps(remote, auth, botPRs)
      const problems = [meta, remoteCommits, runs, issues, pulls].map((result) => result.error).filter(Boolean)
      if (!meta.item) {
        return {
          isRepo: true,
          local,
          commits,
          remote,
          tokenConfigured: !!auth,
          error: problems[0] ?? "GitHub repository could not be loaded",
        } satisfies Schema.Overview
      }
      return {
        isRepo: true,
        local,
        commits: remoteCommits.items ?? commits,
        remote,
        github: {
          meta: meta.item,
          commits: remoteCommits.items ?? [],
          runs: runs.items ?? [],
          issues: issues.items ?? [],
          pulls: pulls.items ?? [],
          deps,
        },
        tokenConfigured: !!auth,
        error: problems[0],
      } satisfies Schema.Overview
    })

    return Service.of({ overview })
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [Location.node, Git.node, httpClient] })

function parseGitHubRemote(input: string): Schema.Remote | undefined {
  const cleaned = input.trim().replace(/\.git$/, "")
  const match =
    /^git@github\.com:([^/\s]+)\/([^/\s]+)$/.exec(cleaned) ??
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)$/.exec(cleaned) ??
    /^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+)$/.exec(cleaned)
  if (!match) return undefined
  const [, owner, repo] = match
  if (!owner || !repo) return undefined
  return { owner, repo, htmlUrl: `https://github.com/${owner}/${repo}` }
}

function toIssue(entry: Record<string, unknown>): Schema.Issue[] {
  const number = typeof entry["number"] === "number" ? entry["number"] : undefined
  const title = typeof entry["title"] === "string" ? entry["title"] : undefined
  const user = isRecord(entry["user"]) && typeof entry["user"]["login"] === "string" ? entry["user"]["login"] : undefined
  const htmlUrl = typeof entry["html_url"] === "string" ? entry["html_url"] : undefined
  const createdAt = typeof entry["created_at"] === "string" ? entry["created_at"] : undefined
  const updatedAt = typeof entry["updated_at"] === "string" ? entry["updated_at"] : undefined
  if (number === undefined || !title || !user || !htmlUrl || !createdAt || !updatedAt) return []
  const labels = Array.isArray(entry["labels"])
    ? entry["labels"].flatMap((label) => (isRecord(label) && typeof label["name"] === "string" ? [label["name"]] : []))
    : []
  return [{ number, title, author: user, labels, htmlUrl, createdAt, updatedAt }]
}

function isBotAuthor(author: string) {
  return author === "dependabot[bot]" || author === "renovate[bot]"
}

function isConclusion(value: string | undefined): value is Schema.RunConclusion {
  return (
    value === "success" ||
    value === "failure" ||
    value === "cancelled" ||
    value === "skipped" ||
    value === "timed_out" ||
    value === "action_required" ||
    value === "neutral" ||
    value === "stale"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
