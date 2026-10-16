import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { GithubOverview } from "../src/github-overview"

describe("github-overview contract", () => {
  test("overview omits optional keys while encoding", () => {
    const value = {
      isRepo: true,
      commits: [],
      tokenConfigured: false,
    }
    expect(Schema.encodeSync(GithubOverview.Overview)(value)).toEqual(value)
    expect(Schema.decodeUnknownSync(GithubOverview.Overview)(value)).toEqual(value)
  })

  test("overview round-trips a fully populated payload", () => {
    const value = {
      isRepo: true,
      local: {
        branch: "dev",
        defaultBranch: "main",
        staged: 1,
        unstaged: 2,
        untracked: 0,
        ahead: 3,
        behind: 0,
      },
      commits: [
        {
          sha: "abc123",
          message: "ship it",
          author: "sam",
          committedAt: "2026-10-15T00:00:00Z",
          htmlUrl: "https://github.com/o/r/commit/abc123",
        },
      ],
      remote: { owner: "o", repo: "r", htmlUrl: "https://github.com/o/r" },
      github: {
        meta: { stars: 1, forks: 0, openIssues: 2 },
        commits: [],
        runs: [
          {
            workflowName: "ci",
            status: "completed",
            conclusion: "success",
            runNumber: 7,
            branch: "dev",
            htmlUrl: "https://github.com/o/r/actions/runs/7",
            updatedAt: "2026-10-15T00:00:00Z",
          },
        ],
        issues: [],
        pulls: [],
        deps: { critical: 0, high: 1, medium: 0, low: 0, updatePRs: 2, alertsAvailable: false },
      },
      tokenConfigured: false,
    }
    const decoded = Schema.decodeUnknownSync(GithubOverview.Overview)(value)
    expect(Schema.encodeSync(GithubOverview.Overview)(decoded)).toEqual(value)
  })

  test("public identifiers are stable and unique", () => {
    const identifiers = [
      GithubOverview.Remote,
      GithubOverview.LocalWork,
      GithubOverview.Commit,
      GithubOverview.Run,
      GithubOverview.Issue,
      GithubOverview.PullRequest,
      GithubOverview.DependencySummary,
      GithubOverview.RepoMeta,
      GithubOverview.RemoteData,
      GithubOverview.Overview,
    ].map((schema) => schema.ast.annotations?.identifier)
    expect(identifiers.every((identifier) => typeof identifier === "string")).toBe(true)
    expect(new Set(identifiers).size).toBe(identifiers.length)
  })
})
