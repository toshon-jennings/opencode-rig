export * as Review from "./review"

import { randomUUID } from "crypto"
import { Context, Effect, Layer, Schema } from "effect"
import { Review as ReviewSchema } from "@opencode-ai/schema/review"
import { makeLocationNode } from "./effect/app-node"
import { KeyedMutex } from "./effect/keyed-mutex"
import { Git } from "./git"
import { Location } from "./location"
import { RelativePath } from "./schema"

export class RevisionNotFoundError extends Schema.TaggedErrorClass<RevisionNotFoundError>()(
  "Review.RevisionNotFoundError",
  {
    revisionID: ReviewSchema.RevisionID,
  },
) {}

export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()("Review.ConflictError", {
  reason: Schema.Literals(["stale", "overlap"]),
  message: Schema.String,
}) {}

export class RepositoryNotFoundError extends Schema.TaggedErrorClass<RepositoryNotFoundError>()(
  "Review.RepositoryNotFoundError",
  { directory: Schema.String },
) {}

interface HunkState {
  readonly id: ReviewSchema.HunkID
  readonly patch: string
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
  readonly changes: Git.ChangeSet
  readonly files: readonly FileState[]
}

export interface Interface {
  readonly capture: () => Effect.Effect<ReviewSchema.Revision, RepositoryNotFoundError | Git.PatchError>
  readonly mutate: (input: {
    revisionID: ReviewSchema.RevisionID
    operation: ReviewSchema.Operation
    hunkIDs: readonly ReviewSchema.HunkID[]
  }) => Effect.Effect<
    ReviewSchema.Revision,
    RevisionNotFoundError | ConflictError | RepositoryNotFoundError | Git.PatchError
  >
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Review") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const git = yield* Git.Service
    const location = yield* Location.Service
    const revisions = new Map<ReviewSchema.RevisionID, RevisionState>()
    const locks = KeyedMutex.makeUnsafe<string>()

    const repository = Effect.fn("Review.repository")(function* () {
      const repository = yield* git.repo.discover(location.project.directory)
      if (repository) return repository
      return yield* new RepositoryNotFoundError({ directory: location.project.directory })
    })

    const capture = Effect.fn("Review.capture")(function* () {
      const current = yield* repository()
      const changes = yield* git.change.capture({ repository: current, path: current.worktree })
      const id = ReviewSchema.RevisionID.make(randomUUID())
      const files = splitChanges(changes)
      revisions.set(id, {
        repository: current,
        head: yield* git.history.head(current),
        changes,
        files,
      })
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
          hunks: file.hunks.map((hunk) => ({ id: hunk.id })),
        })),
      } satisfies ReviewSchema.Revision
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
          const current = yield* git.change.capture({ repository: state.repository, path: state.repository.worktree })
          const head = yield* git.history.head(state.repository)
          if (current !== state.changes || head !== state.head) {
            return yield* new ConflictError({
              reason: "stale",
              message: "The working tree changed after this review was opened",
            })
          }

          const selected = new Set(input.hunkIDs)
          if (selected.size !== input.hunkIDs.length) {
            return yield* new ConflictError({
              reason: "overlap",
              message: "A hunk can only be selected once",
            })
          }

          const known = new Set(state.files.flatMap((file) => file.hunks.map((hunk) => hunk.id)))
          if ([...selected].some((id) => !known.has(id))) {
            return yield* new ConflictError({
              reason: "stale",
              message: "The selected hunk is no longer available",
            })
          }

          const selectedFiles = state.files.filter((file) => file.hunks.some((hunk) => selected.has(hunk.id)))
          const rejected =
            input.operation === "accept"
              ? selectedHunks(selectedFiles, selected, false)
              : selectedHunks(state.files, selected, true)
          const changes = patch(rejected)
          if (changes) {
            yield* git.change
              .apply({
                repository: state.repository,
                path: state.repository.worktree,
                changes,
                check: true,
                reverse: true,
              })
              .pipe(Effect.mapError((error) => new ConflictError({ reason: "overlap", message: error.message })))
            yield* git.change
              .apply({ repository: state.repository, path: state.repository.worktree, changes, reverse: true })
              .pipe(Effect.mapError((error) => new ConflictError({ reason: "overlap", message: error.message })))
          }

          revisions.delete(input.revisionID)
          return yield* capture()
        }),
      )
    })

    return Service.of({ capture, mutate })
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [Location.node, Git.node] })

function splitChanges(changes: Git.ChangeSet) {
  return changes
    .split(/(?=^diff --git )/m)
    .filter(Boolean)
    .flatMap((file) => {
      const path = filePath(file)
      if (!path) return []
      const starts = [...file.matchAll(/^@@ .+$/gm)].map((match) => match.index ?? 0)
      if (starts.length === 0) return []
      const header = file.slice(0, starts[0])
      const hunks = starts.map((start, index) => ({
        id: ReviewSchema.HunkID.make(randomUUID()),
        patch: file.slice(start, starts[index + 1]),
      }))
      return [
        {
          id: ReviewSchema.FileID.make(randomUUID()),
          path,
          header,
          hunks,
        } satisfies FileState,
      ]
    })
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

function patch(files: readonly (readonly [FileState, HunkState])[]) {
  if (files.length === 0) return undefined
  const grouped = new Map<ReviewSchema.FileID, { header: string; hunks: HunkState[] }>()
  files.forEach(([file, hunk]) => {
    const value = grouped.get(file.id) ?? { header: file.header, hunks: [] }
    value.hunks.push(hunk)
    grouped.set(file.id, value)
  })
  return Git.ChangeSet.make(
    [...grouped.values()].map((file) => `${file.header}${file.hunks.map((hunk) => hunk.patch).join("")}`).join(""),
  )
}

function selectedHunks(
  files: readonly FileState[],
  selected: ReadonlySet<ReviewSchema.HunkID>,
  include: boolean,
): readonly (readonly [FileState, HunkState])[] {
  return files.flatMap((file) =>
    file.hunks.flatMap((hunk): readonly (readonly [FileState, HunkState])[] => {
      if (selected.has(hunk.id) !== include) return []
      return [[file, hunk]]
    }),
  )
}
