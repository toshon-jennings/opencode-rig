import { $ } from "bun"
import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { Location } from "@opencode-ai/core/location"
import { Review } from "@opencode-ai/core/review"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(Layer.empty)

describe("Review", () => {
  it.live("keeps only accepted hunks in a real working tree", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        const revision = yield* review.capture()
        const file = revision.files[0]
        if (!file) throw new Error("Expected reviewed file")
        expect(file.hunks).toHaveLength(2)
        const selected = file.hunks[0]
        if (!selected) throw new Error("Expected first hunk")

        yield* review.mutate({ revisionID: revision.id, operation: "accept", hunkIDs: [selected.id] })

        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed two")
        expect(yield* read(path.join(directory, "file.txt"))).toContain("eighteen\n")
      }),
    ),
  )

  it.live("keeps changes in other files when accepting a selected hunk", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "second.txt"), "changed second\n"))
        const revision = yield* review.capture()
        const file = revision.files.find((item) => item.path === "file.txt")
        const selected = file?.hunks[0]
        if (!selected) throw new Error("Expected first file hunk")

        yield* review.mutate({ revisionID: revision.id, operation: "accept", hunkIDs: [selected.id] })

        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed two")
        expect(yield* read(path.join(directory, "second.txt"))).toBe("changed second\n")
      }),
    ),
  )

  it.live("rejects only selected hunks in a real working tree", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        const revision = yield* review.capture()
        const file = revision.files[0]
        if (!file) throw new Error("Expected reviewed file")
        const selected = file.hunks[0]
        if (!selected) throw new Error("Expected first hunk")

        yield* review.mutate({ revisionID: revision.id, operation: "reject", hunkIDs: [selected.id] })

        expect(yield* read(path.join(directory, "file.txt"))).toContain("two\n")
        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed eighteen")
      }),
    ),
  )

  it.live("rejects stale review revisions before writing", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        const revision = yield* review.capture()
        const file = revision.files[0]
        const selected = file?.hunks[0]
        if (!selected) throw new Error("Expected selected hunk")
        yield* Effect.promise(() => fs.appendFile(path.join(directory, "file.txt"), "stale\n"))

        const result = yield* review
          .mutate({ revisionID: revision.id, operation: "reject", hunkIDs: [selected.id] })
          .pipe(Effect.flip)

        expect(result).toBeInstanceOf(Review.ConflictError)
        if (!(result instanceof Review.ConflictError)) return
        expect(result.reason).toBe("stale")
        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed two")
      }),
    ),
  )

  it.live("rejects overlapping hunk selections before writing", () =>
    withReview((directory) =>
      Effect.gen(function* () {
        const review = yield* Review.Service
        const revision = yield* review.capture()
        const file = revision.files[0]
        const selected = file?.hunks[0]
        if (!selected) throw new Error("Expected selected hunk")

        const result = yield* review
          .mutate({ revisionID: revision.id, operation: "reject", hunkIDs: [selected.id, selected.id] })
          .pipe(Effect.flip)

        expect(result).toBeInstanceOf(Review.ConflictError)
        if (!(result instanceof Review.ConflictError)) return
        expect(result.reason).toBe("overlap")
        expect(yield* read(path.join(directory, "file.txt"))).toContain("changed two")
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
      await fs.writeFile(path.join(directory, "file.txt"), initial())
      await $`git init`.cwd(directory).quiet()
      await $`git config user.email test@opencode.test`.cwd(directory).quiet()
      await $`git config user.name Test`.cwd(directory).quiet()
      await $`git add .`.cwd(directory).quiet()
      await $`git commit --no-gpg-sign -m initial`.cwd(directory).quiet()
      await fs.writeFile(path.join(directory, "file.txt"), changed())
      return { root, directory }
    }),
    (input) =>
      body(input.directory).pipe(
        Effect.provide(
          AppNodeBuilder.build(Review.node, [
            [Location.node, Location.boundNode(Location.Ref.make({ directory: AbsolutePath.make(input.directory) }))],
          ]),
        ),
      ),
    (input) => Effect.promise(() => input.root[Symbol.asyncDispose]()),
  )
}

function initial() {
  return Array.from({ length: 20 }, (_, index) => `${number(index + 1)}\n`).join("")
}

function changed() {
  return Array.from({ length: 20 }, (_, index) => {
    if (index === 1) return "changed two\n"
    if (index === 17) return "changed eighteen\n"
    return `${number(index + 1)}\n`
  }).join("")
}

function number(value: number) {
  return [
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
  ][value - 1]
}

function read(file: string) {
  return Effect.promise(() => fs.readFile(file, "utf8")).pipe(Effect.map((content) => content.replaceAll("\r\n", "\n")))
}
