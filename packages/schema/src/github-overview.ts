export * as GithubOverview from "./github-overview"

import { Schema } from "effect"
import { optional } from "./schema"

export const Remote = Schema.Struct({
  owner: Schema.String,
  repo: Schema.String,
  htmlUrl: Schema.String,
}).annotate({ identifier: "GithubOverview.Remote" })
export interface Remote extends Schema.Schema.Type<typeof Remote> {}

export const LocalWork = Schema.Struct({
  branch: optional(Schema.String),
  defaultBranch: optional(Schema.String),
  staged: Schema.Number,
  unstaged: Schema.Number,
  untracked: Schema.Number,
  ahead: Schema.Number,
  behind: Schema.Number,
}).annotate({ identifier: "GithubOverview.LocalWork" })
export interface LocalWork extends Schema.Schema.Type<typeof LocalWork> {}

export const Commit = Schema.Struct({
  sha: Schema.String,
  message: Schema.String,
  author: Schema.String,
  committedAt: Schema.String,
  htmlUrl: optional(Schema.String),
}).annotate({ identifier: "GithubOverview.Commit" })
export interface Commit extends Schema.Schema.Type<typeof Commit> {}

export const RunConclusion = Schema.Literals([
  "success",
  "failure",
  "cancelled",
  "skipped",
  "timed_out",
  "action_required",
  "neutral",
  "stale",
])
export type RunConclusion = typeof RunConclusion.Type

export const Run = Schema.Struct({
  workflowName: Schema.String,
  status: Schema.String,
  conclusion: optional(RunConclusion),
  runNumber: Schema.Number,
  branch: Schema.String,
  htmlUrl: Schema.String,
  updatedAt: Schema.String,
}).annotate({ identifier: "GithubOverview.Run" })
export interface Run extends Schema.Schema.Type<typeof Run> {}

export const Issue = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  author: Schema.String,
  labels: Schema.Array(Schema.String),
  htmlUrl: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}).annotate({ identifier: "GithubOverview.Issue" })
export interface Issue extends Schema.Schema.Type<typeof Issue> {}

export const PullRequest = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  author: Schema.String,
  draft: Schema.Boolean,
  htmlUrl: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}).annotate({ identifier: "GithubOverview.PullRequest" })
export interface PullRequest extends Schema.Schema.Type<typeof PullRequest> {}

export const DependencySummary = Schema.Struct({
  critical: Schema.Number,
  high: Schema.Number,
  medium: Schema.Number,
  low: Schema.Number,
  updatePRs: Schema.Number,
  alertsAvailable: Schema.Boolean,
}).annotate({ identifier: "GithubOverview.DependencySummary" })
export interface DependencySummary extends Schema.Schema.Type<typeof DependencySummary> {}

export const RepoMeta = Schema.Struct({
  description: optional(Schema.String),
  stars: Schema.Number,
  forks: Schema.Number,
  openIssues: Schema.Number,
  language: optional(Schema.String),
}).annotate({ identifier: "GithubOverview.RepoMeta" })
export interface RepoMeta extends Schema.Schema.Type<typeof RepoMeta> {}

export const RemoteData = Schema.Struct({
  meta: RepoMeta,
  commits: Schema.Array(Commit),
  runs: Schema.Array(Run),
  issues: Schema.Array(Issue),
  pulls: Schema.Array(PullRequest),
  deps: DependencySummary,
}).annotate({ identifier: "GithubOverview.RemoteData" })
export interface RemoteData extends Schema.Schema.Type<typeof RemoteData> {}

export const Overview = Schema.Struct({
  isRepo: Schema.Boolean,
  local: optional(LocalWork),
  commits: Schema.Array(Commit),
  remote: optional(Remote),
  github: optional(RemoteData),
  tokenConfigured: Schema.Boolean,
  error: optional(Schema.String),
}).annotate({ identifier: "GithubOverview.Overview" })
export interface Overview extends Schema.Schema.Type<typeof Overview> {}
