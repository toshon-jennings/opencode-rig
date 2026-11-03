import { $ } from "bun"
import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect, Layer } from "effect"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { httpClient } from "@opencode/util/effect/app-node-platform"
import { AppProcess } from "@opencode/util/process"
import { FSUtil } from "@opencode/util/fs-util"
import { Git } from "@opencode/core/git"
import { GithubOverview } from "@opencode/core/github-overview"
import { Location } from "@opencode/core/location"
import { AbsolutePath } from "@opencode/core/schema"
import { initGit } from "./fixture/git"
import { location } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

describe("GithubOverview", () => {
  it.live("reports local work and commits of a repository without a GitHub remote", () =>
    withOverview(
      async (directory) => {
        await initGit(directory)
        await fs.writeFile(path.join(directory, "kept.txt"), "one\n")
        await fs.writeFile(path.join(directory, "edited.txt"), "one\n")
        await $`git add .`.cwd(directory).quiet()
        await $`git commit -m initial`.cwd(directory).quiet()
        await fs.writeFile(path.join(directory, "edited.txt"), "two\n")
        await fs.writeFile(path.join(directory, "staged.txt"), "new\n")
        await $`git add staged.txt`.cwd(directory).quiet()
        await fs.writeFile(path.join(directory, "untracked.txt"), "new\n")
      },
      (overview) => {
        expect(overview.isRepo).toBe(true)
        expect(overview.remote).toBeUndefined()
        expect(overview.github).toBeUndefined()
        expect(overview.local).toMatchObject({ staged: 1, unstaged: 1, untracked: 1, ahead: 0, behind: 0 })
        expect(overview.commits.map((commit) => commit.message)).toEqual(["initial"])
        expect(overview.commits[0]?.htmlUrl).toBeUndefined()
      },
    ),
  )

  it.live("reports a directory outside git as not a repository", () =>
    withOverview(
      async () => {},
      (overview) => {
        expect(overview.isRepo).toBe(false)
        expect(overview.commits).toEqual([])
      },
    ),
  )
})

describe("parseGitHubRemote", () => {
  test("reads SSH, HTTPS and ssh:// remotes", () => {
    const expected = { owner: "o", repo: "r", htmlUrl: "https://github.com/o/r" }
    expect(GithubOverview.parseGitHubRemote("git@github.com:o/r.git")).toEqual(expected)
    expect(GithubOverview.parseGitHubRemote("https://github.com/o/r")).toEqual(expected)
    expect(GithubOverview.parseGitHubRemote("https://user@github.com/o/r.git\n")).toEqual(expected)
    expect(GithubOverview.parseGitHubRemote("ssh://git@github.com/o/r.git")).toEqual(expected)
  })

  test("ignores remotes on other hosts", () => {
    expect(GithubOverview.parseGitHubRemote("git@gitlab.com:o/r.git")).toBeUndefined()
    expect(GithubOverview.parseGitHubRemote("https://github.com/o")).toBeUndefined()
  })
})

function withOverview(
  prepare: (directory: string) => Promise<void>,
  check: (overview: Effect.Success<ReturnType<GithubOverview.Interface["overview"]>>) => void,
) {
  return Effect.acquireUseRelease(
    Effect.promise(async () => {
      const root = await tmpdir()
      const directory = path.join(root.path, "project")
      await fs.mkdir(directory)
      await prepare(directory)
      return { root, directory }
    }),
    (input) =>
      Effect.gen(function* () {
        const github = yield* GithubOverview.Service
        check(yield* github.overview())
      }).pipe(
        Effect.provide(
          LayerNode.compile(
            LayerNode.group([GithubOverview.node, Location.node, AppProcess.node, FSUtil.node, Git.node, httpClient]),
            {
              replacements: [
                Location.node.replace(
                  Layer.succeed(
                    Location.Service,
                    Location.Service.of(location({ directory: AbsolutePath.make(input.directory) })),
                  ),
                ),
              ],
            },
          ),
        ),
      ),
    (input) => Effect.promise(() => input.root[Symbol.asyncDispose]()),
  )
}
