import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { FileSystemSearch } from "@opencode-ai/core/filesystem/search"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Location } from "@opencode-ai/core/location"
import { ProjectV2 } from "@opencode-ai/core/project"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { AbsolutePath, RelativePath } from "@opencode-ai/core/schema"
import { tmpdir } from "../fixture/tmpdir"
import { testEffect } from "../lib/effect"

const it = testEffect(LayerNode.compile(Ripgrep.node))

const withTmp = <A, E, R>(f: (directory: AbsolutePath) => Effect.Effect<A, E, R>) =>
  Effect.acquireRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  ).pipe(Effect.flatMap((tmp) => f(AbsolutePath.make(tmp.path))))

describe("Ripgrep", () => {
  it.live("globs files as an array", () =>
    withTmp((cwd) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fs.mkdir(path.join(cwd, "src")))
        yield* Effect.promise(() => fs.writeFile(path.join(cwd, "src", "match.ts"), "needle\n"))
        const result = yield* (yield* Ripgrep.Service).glob({ cwd, pattern: "**/*.ts", limit: 10 })
        expect(result.map((item) => item.path)).toEqual([RelativePath.make("src/match.ts")])
      }),
    ),
  )

  it.live("greps files with include filtering", () =>
    withTmp((cwd) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fs.mkdir(path.join(cwd, "src")))
        yield* Effect.promise(() => fs.writeFile(path.join(cwd, "src", "match.ts"), "needle\n"))
        yield* Effect.promise(() => fs.writeFile(path.join(cwd, "src", "skip.txt"), "needle\n"))
        const result = yield* (yield* Ripgrep.Service).grep({ cwd, pattern: "needle", include: "*.ts", limit: 10 })
        expect(result).toHaveLength(1)
        expect(result[0]?.entry.path).toBe(RelativePath.make("src/match.ts"))
        expect(result[0]?.submatches[0]?.text).toBe("needle")
      }),
    ),
  )
})

test("non-git search exposes direct child directories before background indexing completes", async () => {
  await using tmp = await tmpdir()
  await Promise.all([fs.mkdir(path.join(tmp.path, "Documents")), fs.mkdir(path.join(tmp.path, "Downloads"))])
  const directory = AbsolutePath.make(tmp.path)
  const dependencies = LayerNode.compile(LayerNode.group([FSUtil.node, Ripgrep.node]))
  const location = Layer.succeed(
    Location.Service,
    Location.Service.of({
      directory,
      workspaceID: undefined,
      project: { id: ProjectV2.ID.global, directory },
      vcs: undefined,
    }),
  )
  const layer = FileSystemSearch.ripgrepLayer.pipe(Layer.provide(Layer.merge(dependencies, location)))

  const result = await Effect.runPromise(
    FileSystemSearch.Service.use((search) => search.find({ query: "", limit: 50 })).pipe(
      Effect.provide(layer),
      Effect.scoped,
    ),
  )

  expect(result.map((entry) => entry.path)).toEqual([
    RelativePath.make(`Documents${path.sep}`),
    RelativePath.make(`Downloads${path.sep}`),
  ])
})
