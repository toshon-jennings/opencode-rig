import type { SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import type { FileDiffInfo } from "@opencode-ai/client/promise"
import type { Kind } from "@/components/file-tree-v2"
import { normalizeFileTreeV2Path } from "@/components/file-tree-v2-model"
import type { SessionReviewFileFilter } from "@opencode-ai/session-ui/v2/session-review-v2"

export type RenderDiff = FileDiffInfo | (SnapshotFileDiff & { file: string }) | VcsFileDiff

export function normalizePath(p: string) {
  return normalizeFileTreeV2Path(p)
}

export function filterRenderableDiff(value: FileDiffInfo | SnapshotFileDiff | VcsFileDiff): value is RenderDiff {
  return typeof value.file === "string"
}

export function reviewDiffNeedsLoad(diff: RenderDiff) {
  if (diff.additions === 0 && diff.deletions === 0) return false
  return !diff.patch || !/^@@ /m.test(diff.patch)
}

export function reviewRootDirectory(root: string) {
  return root === "/" || /^[A-Za-z]:[/\\]?$/.test(root) ? root : root.replace(/[/\\]+$/, "")
}

export function reviewDiffDirectory(root: string, file: string) {
  const path = normalizePath(file)
  const index = path.lastIndexOf("/")
  const separator = root.includes("\\") ? "\\" : "/"
  const base = reviewRootDirectory(root)
  if (index < 0) return base
  return `${base.endsWith(separator) ? base : base + separator}${path.slice(0, index).replaceAll("/", separator)}`
}

export function reviewDiffKinds(diffs: RenderDiff[]) {
  const merge = (a: Kind | undefined, b: Kind) => {
    if (!a) return b
    if (a === b) return a
    return "mix" as const
  }

  const out = new Map<string, Kind>()
  for (const diff of diffs) {
    const file = normalizePath(diff.file)
    const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"

    out.set(file, kind)

    const parts = file.split("/")
    parts.slice(0, -1).forEach((_, idx) => {
      const dir = parts.slice(0, idx + 1).join("/")
      if (!dir) return
      out.set(dir, merge(out.get(dir), kind))
    })
  }
  return out
}

export function filterReviewFiles(files: string[], query: string) {
  const value = query.trim().toLowerCase()
  if (!value) return files
  return files.filter((file) => file.toLowerCase().includes(value))
}

export function filterReviewDiffs(diffs: RenderDiff[], filters: readonly SessionReviewFileFilter[]) {
  if (filters.length === 0) return diffs
  return diffs.filter((diff) => filters.every((filter) => matchesReviewFilter(diff, filter)))
}

function matchesReviewFilter(diff: RenderDiff, filter: SessionReviewFileFilter) {
  if (filter === "tests")
    return /(^|[/_.-])(?:test|tests|spec|specs|__tests__)(?:[/_.-]|$)|\.(?:test|spec)\.[^.]+$/i.test(diff.file)
  if (filter === "large") return diff.additions + diff.deletions >= 500
  const extension = diff.file.split(".").pop()?.toLowerCase()
  return [
    "astro",
    "c",
    "cc",
    "cpp",
    "cs",
    "css",
    "go",
    "h",
    "hpp",
    "html",
    "java",
    "js",
    "jsx",
    "json",
    "kt",
    "lua",
    "md",
    "mjs",
    "php",
    "py",
    "rb",
    "rs",
    "sh",
    "sql",
    "svelte",
    "swift",
    "toml",
    "ts",
    "tsx",
    "vue",
    "xml",
    "yaml",
    "yml",
  ].includes(extension ?? "")
}
