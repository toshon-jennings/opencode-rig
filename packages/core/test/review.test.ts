import { $ } from "bun"
import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect, Layer } from "effect"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { AppProcess } from "@opencode/util/process"
import { FSUtil } from "@opencode/util/fs-util"
import { Git } from "@opencode/core/git"
import { Location } from "@opencode/core/location"
import { Review } from "@opencode/core/review"
import { AbsolutePath } from "@opencode/core/schema"
import { initGit } from "./fixture/git"
import { location } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

describe("Review", () => {
  it.live("keeps only accepted hunks in a real working tree", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        const revision = yield* review.capture()
        const file = revision.files[0]
        expect(file?.hunks.map((hunk) => hunk.line)).toEqual([2, 18])
        const selected = file?.hunks[0]
        if (!selected) throw new Error("Expected first hunk")

        yield* review.mutate({ revisionID: revision.id, operation: "accept", hunkIDs: [selected.id] })

        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed 2\n")
        expect(yield* read(path.join(directory, "file.txt"))).toContain("line 18\n")
      }),
    ),
  )

  it.live("keeps changes in other files when accepting a selected hunk", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "second.txt"), "changed second\n"))
        const revision = yield* review.capture()
        const selected = revision.files.find((item) => item.path === "file.txt")?.hunks[0]
        if (!selected) throw new Error("Expected first file hunk")

        yield* review.mutate({ revisionID: revision.id, operation: "accept", hunkIDs: [selected.id] })

        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed 2\n")
        expect(yield* read(path.join(directory, "second.txt"))).toBe("changed second\n")
      }),
    ),
  )

  it.live("rejects only selected hunks in a real working tree", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        const revision = yield* review.capture()
        const selected = revision.files[0]?.hunks[0]
        if (!selected) throw new Error("Expected first hunk")

        yield* review.mutate({ revisionID: revision.id, operation: "reject", hunkIDs: [selected.id] })

        expect(yield* read(path.join(directory, "file.txt"))).toContain("line 2\n")
        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed 18\n")
      }),
    ),
  )

  it.live("rejecting a new file removes it", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "new.txt"), "brand new\n"))
        const revision = yield* review.capture()
        const selected = revision.files.find((item) => item.path === "new.txt")?.hunks[0]
        if (!selected) throw new Error("Expected the new file's hunk")

        yield* review.mutate({ revisionID: revision.id, operation: "reject", hunkIDs: [selected.id] })

        expect(
          yield* Effect.promise(() => fs.stat(path.join(directory, "new.txt")).catch(() => undefined)),
        ).toBeUndefined()
      }),
    ),
  )

  it.live("rejects stale review revisions before writing", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        const revision = yield* review.capture()
        const selected = revision.files[0]?.hunks[0]
        if (!selected) throw new Error("Expected selected hunk")
        yield* Effect.promise(() => fs.appendFile(path.join(directory, "file.txt"), "stale\n"))

        const result = yield* review
          .mutate({ revisionID: revision.id, operation: "reject", hunkIDs: [selected.id] })
          .pipe(Effect.flip)

        expect(result).toBeInstanceOf(Review.ConflictError)
        if (!(result instanceof Review.ConflictError)) return
        expect(result.reason).toBe("stale")
        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed 2\n")
      }),
    ),
  )

  it.live("rejects overlapping hunk selections before writing", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        const revision = yield* review.capture()
        const selected = revision.files[0]?.hunks[0]
        if (!selected) throw new Error("Expected selected hunk")

        const result = yield* review
          .mutate({ revisionID: revision.id, operation: "reject", hunkIDs: [selected.id, selected.id] })
          .pipe(Effect.flip)

        expect(result).toBeInstanceOf(Review.ConflictError)
        if (!(result instanceof Review.ConflictError)) return
        expect(result.reason).toBe("overlap")
        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed 2\n")
      }),
    ),
  )
})

function withReview<A, E>(body: (directory: string) => Effect.Effect<A, E, Review.Service>) {
  return Effect.acquireUseRelease(
    Effect.promise(async () => {
      const root = await tmpdir()
      const directory = path.join(root.path, "project")
      await fs.mkdir(directory)
      await initGit(directory)
      await fs.writeFile(path.join(directory, "file.txt"), lines())
      await $`git add .`.cwd(directory).quiet()
      await $`git commit -m initial`.cwd(directory).quiet()
      await fs.writeFile(path.join(directory, "file.txt"), lines({ 2: "changed 2", 18: "changed 18" }))
      return { root, directory }
    }),
    (input) =>
      body(input.directory).pipe(
        Effect.provide(
          LayerNode.compile(LayerNode.group([Review.node, Location.node, AppProcess.node, FSUtil.node, Git.node]), {
            replacements: [
              Location.node.replace(
                Layer.succeed(
                  Location.Service,
                  Location.Service.of(location({ directory: AbsolutePath.make(input.directory) })),
                ),
              ),
            ],
          }),
        ),
      ),
    (input) => Effect.promise(() => input.root[Symbol.asyncDispose]()),
  )
}

/** Twenty lines, far enough apart that changing lines 2 and 18 yields two hunks. */
function lines(changes: Record<number, string> = {}) {
  return Array.from({ length: 20 }, (_, index) => `${changes[index + 1] ?? `line ${index + 1}`}\n`).join("")
}

function read(file: string) {
  return Effect.promise(() => fs.readFile(file, "utf8")).pipe(Effect.map((content) => content.replaceAll("\r\n", "\n")))
}
