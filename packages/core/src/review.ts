export * as Review from "./review.js"

import { randomUUID } from "crypto"
import { Context, Effect, Layer, Schema, Stream } from "effect"
import { ChildProcess } from "effect/process"
import { Review as ReviewSchema } from "@opencode/schema/review"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { AppProcess } from "@opencode/util/process"
import { KeyedMutex } from "./effect/keyed-mutex.js"
import { Git } from "./git.js"
import { Location } from "./location.js"
import { AbsolutePath, RelativePath } from "./schema.js"
import { gitExecutable } from "./util/git-executable.js"

export class RevisionNotFoundError extends Schema.TaggedError<RevisionNotFoundError>()("Review.RevisionNotFoundError", {
  revisionID: ReviewSchema.RevisionID,
}) {}

export class ConflictError extends Schema.TaggedError<ConflictError>()("Review.ConflictError", {
  reason: Schema.Literals(["stale", "overlap"]),
  message: Schema.String,
}) {}

export class RepositoryNotFoundError extends Schema.TaggedError<RepositoryNotFoundError>()(
  "Review.RepositoryNotFoundError",
  { directory: Schema.String },
) {}

export class GitError extends Schema.TaggedError<GitError>()("Review.GitError", {
  message: Schema.String,
}) {}

interface HunkState {
  readonly id: ReviewSchema.HunkID
  readonly patch: string
  readonly line: number
}

interface FileState {
  readonly id: ReviewSchema.FileID
  readonly path: RelativePath
  readonly header: string
  readonly hunks: readonly HunkState[]
}

interface RevisionState {
  readonly repository: Git.Repository
  readonly head?: string
  /** The whole working-tree diff at capture time; a mutation only runs while it is unchanged. */
  readonly changes: string
  readonly files: readonly FileState[]
}

export interface Interface {
  readonly capture: () => Effect.Effect<ReviewSchema.Revision, RepositoryNotFoundError | GitError>
  /**
   * `reject` reverse-applies the selected hunks. `accept` keeps them and reverse-applies the other hunks of the files
   * they belong to. Neither touches the git index.
   */
  readonly mutate: (input: {
    revisionID: ReviewSchema.RevisionID
    operation: ReviewSchema.Operation
    hunkIDs: readonly ReviewSchema.HunkID[]
  }) => Effect.Effect<ReviewSchema.Revision, RevisionNotFoundError | ConflictError | RepositoryNotFoundError | GitError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Review") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const git = yield* Git.Service
    const proc = yield* AppProcess.Service
    const location = yield* Location.Service
    const revisions = new Map<ReviewSchema.RevisionID, RevisionState>()
    const locks = KeyedMutex.makeUnsafe<string>()

    // Repository config must not change what git runs or prints: no fsmonitor hook, no CRLF rewriting, and (below)
    // no external diff driver, textconv or color codes in a patch that is applied back to the tree.
    const config = ["--no-optional-locks", "-c", "core.autocrlf=false", "-c", "core.fsmonitor=false"]
    const plain = ["--binary", "--no-ext-diff", "--no-textconv", "--no-color"]

    const execute = (cwd: string, args: string[], stdin?: string) =>
      proc
        .run(
          ChildProcess.make(gitExecutable(), [...config, ...args], {
            cwd,
            extendEnv: true,
            stdin: stdin === undefined ? "ignore" : Stream.make(new TextEncoder().encode(stdin)),
          }),
        )
        .pipe(
          Effect.mapError((cause) => new GitError({ message: cause.message })),
          Effect.map((result) => ({
            exitCode: result.exitCode,
            text: result.stdout.toString("utf8"),
            stderr: result.stderr.toString("utf8").trim(),
          })),
        )

    const succeed = (cwd: string, args: string[], stdin?: string) =>
      execute(cwd, args, stdin).pipe(
        Effect.flatMap((result) =>
          result.exitCode === 0
            ? Effect.succeed(result.text)
            : Effect.fail(new GitError({ message: result.stderr || result.text.trim() || `git ${args[0]} failed` })),
        ),
      )

    const repository = Effect.fn("Review.repository")(function* () {
      const repository = yield* git.repo.discover(AbsolutePath.make(location.project.directory))
      if (repository) return repository
      return yield* new RepositoryNotFoundError({ directory: location.project.directory })
    })

    const diff = Effect.fn("Review.diff")(function* (worktree: string) {
      const tracked = yield* succeed(worktree, ["diff", ...plain, "HEAD"])
      const untracked = yield* succeed(worktree, ["ls-files", "--others", "--exclude-standard", "-z"])
      const created = yield* Effect.forEach(untracked.split("\0").filter(Boolean), (file) =>
        // `git diff --no-index` exits 1 when it finds differences.
        execute(worktree, ["diff", ...plain, "--no-index", "--", "/dev/null", file]).pipe(
          Effect.flatMap((result) =>
            result.exitCode <= 1
              ? Effect.succeed(result.text)
              : Effect.fail(new GitError({ message: result.stderr || `Failed to read new file ${file}` })),
          ),
        ),
      )
      return [tracked, ...created].filter(Boolean).join("\n")
    })

    const capture = Effect.fn("Review.capture")(function* () {
      const current = yield* repository()
      const changes = yield* diff(current.worktree)
      const id = ReviewSchema.RevisionID.make(randomUUID())
      const files = splitChanges(changes)
      revisions.set(id, { repository: current, head: yield* git.history.head(current), changes, files })
      while (revisions.size > 64) {
        const oldest = revisions.keys().next().value
        if (!oldest) break
        revisions.delete(oldest)
      }
      return {
        id,
        files: files.map((file) => ({
          id: file.id,
          path: file.path,
          hunks: file.hunks.map((hunk) => ({ id: hunk.id, line: hunk.line })),
        })),
      } satisfies ReviewSchema.Revision
    })

    const reverse = (state: RevisionState, changes: string) =>
      Effect.gen(function* () {
        const apply = (check: boolean) =>
          succeed(state.repository.worktree, ["apply", ...(check ? ["--check"] : []), "--reverse", "-"], changes).pipe(
            Effect.mapError((error) => new ConflictError({ reason: "overlap", message: error.message })),
          )
        // Check first so a patch that does not apply cannot leave the tree half changed.
        yield* apply(true)
        yield* apply(false)
      })

    const mutate = Effect.fn("Review.mutate")(function* (input: {
      revisionID: ReviewSchema.RevisionID
      operation: ReviewSchema.Operation
      hunkIDs: readonly ReviewSchema.HunkID[]
    }) {
      const state = revisions.get(input.revisionID)
      if (!state) return yield* new RevisionNotFoundError({ revisionID: input.revisionID })

      return yield* locks.withLock(state.repository.worktree)(
        Effect.gen(function* () {
          const current = yield* diff(state.repository.worktree)
          const head = yield* git.history.head(state.repository)
          if (current !== state.changes || head !== state.head)
            return yield* new ConflictError({
              reason: "stale",
              message: "The working tree changed after this review was opened",
            })

          const selected = new Set(input.hunkIDs)
          if (selected.size !== input.hunkIDs.length)
            return yield* new ConflictError({ reason: "overlap", message: "A hunk can only be selected once" })

          const known = new Set(state.files.flatMap((file) => file.hunks.map((hunk) => hunk.id)))
          if ([...selected].some((id) => !known.has(id)))
            return yield* new ConflictError({ reason: "stale", message: "The selected hunk is no longer available" })

          const undone =
            input.operation === "accept"
              ? hunksOf(
                  state.files.filter((file) => file.hunks.some((hunk) => selected.has(hunk.id))),
                  (hunk) => !selected.has(hunk.id),
                )
              : hunksOf(state.files, (hunk) => selected.has(hunk.id))
          const changes = patch(undone)
          if (changes) yield* reverse(state, changes)

          revisions.delete(input.revisionID)
          return yield* capture()
        }),
      )
    })

    return Service.of({ capture, mutate })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [Location.node, Git.node, AppProcess.node],
})

function splitChanges(changes: string) {
  return changes
    .split(/(?=^diff --git )/m)
    .filter(Boolean)
    .flatMap((file) => {
      const path = filePath(file)
      if (!path) return []
      const starts = [...file.matchAll(/^@@ .+$/gm)].map((match) => match.index ?? 0)
      if (starts.length === 0) return []
      return [
        {
          id: ReviewSchema.FileID.make(randomUUID()),
          path,
          header: file.slice(0, starts[0]),
          hunks: starts.map((start, index) => {
            const hunk = file.slice(start, starts[index + 1])
            return { id: ReviewSchema.HunkID.make(randomUUID()), patch: hunk, line: firstChangedLine(hunk) }
          }),
        } satisfies FileState,
      ]
    })
}

/** Counts new-file lines from the `@@ -a,b +c,d @@` header down to the first added or removed line. */
function firstChangedLine(hunk: string) {
  const [header = "", ...body] = hunk.split("\n")
  const start = Number(/^@@ -\d+(?:,\d+)? \+(\d+)/.exec(header)?.[1] ?? 1)
  const context = body.findIndex((line) => line.startsWith("+") || line.startsWith("-"))
  return Math.max(start + (context === -1 ? 0 : context), 1)
}

function filePath(patch: string) {
  const next = /^\+\+\+ (.+)$/m.exec(patch)?.[1]
  const previous = /^--- (.+)$/m.exec(patch)?.[1]
  const value = next === "/dev/null" ? previous : next
  if (!value || value === "/dev/null") return undefined
  const path = value.startsWith('"') ? quotedPath(value) : value
  if (!path?.startsWith("a/") && !path?.startsWith("b/")) return undefined
  return RelativePath.make(path.slice(2))
}

function quotedPath(value: string) {
  try {
    const path: unknown = JSON.parse(value)
    return typeof path === "string" ? path : undefined
  } catch {
    return undefined
  }
}

function hunksOf(files: readonly FileState[], include: (hunk: HunkState) => boolean) {
  return files.flatMap((file) => file.hunks.filter(include).map((hunk) => [file, hunk] as const))
}

function patch(files: readonly (readonly [FileState, HunkState])[]) {
  if (files.length === 0) return undefined
  const grouped = new Map<ReviewSchema.FileID, { header: string; hunks: HunkState[] }>()
  files.forEach(([file, hunk]) => {
    const value = grouped.get(file.id) ?? { header: file.header, hunks: [] }
    value.hunks.push(hunk)
    grouped.set(file.id, value)
  })
  return [...grouped.values()].map((file) => `${file.header}${file.hunks.map((hunk) => hunk.patch).join("")}`).join("")
}
