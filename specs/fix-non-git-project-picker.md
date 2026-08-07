# Spec: "Add project" picker shows no folders

## Context

`opencode-rig` (fork of `anomalyco/opencode`, this repo, branch `dev`) is
being run as a lightweight browser client via `opencode web` instead of the
Electron desktop app. The shared SolidJS UI (`packages/app`) is identical on
both surfaces — this bug reproduces the same way in Electron and in the
browser, it is not web-specific.

## Symptom

In the "Open project" / "Add project" dialog (folder-add icon in the Projects
sidebar), **the picker shows zero folders, period.** Open it and it's empty.
Type a project name and it stays empty. This is a total failure of the
browse/search UX as experienced by a user — there is no discoverable way to
find a project from this dialog.

The one exception, found only through source-level debugging, not through
using the app: if you already know a project's exact full absolute path
(e.g. `/Users/toshonjennings/opencode`) and type that complete string
character-for-character, path breadcrumb suggestions do appear. This is a
different, separate code path (client-side path-segment resolution, not the
fuzzy search) and is not a workaround a real user would find — you can't
type the path of a folder you're trying to discover. Do not report this as
"partially working"; for practical purposes the dialog does not work.

## Root cause (confirmed)

The mechanism below happens to produce correct results if you already know
to type the full path of a folder that's also a git repo — but that is not
a meaningful "it works for git repos" carve-out. Nobody opens this dialog
already knowing the exact path of what they're looking for; if they did,
they wouldn't need the dialog. Treat this as fully broken, not partially
broken.

`packages/core/src/project.ts`, function `resolve` (~line 110-113):

```ts
const resolve = Effect.fn("Project.resolve")(function* (input: AbsolutePath) {
  const repo = yield* git.repo.discover(input)
  if (!repo) return { id: ID.global, directory: AbsolutePath.make(path.parse(input).root), vcs: undefined }
  ...
```

When `git.repo.discover(input)` finds no repository, this returns
`directory: path.parse(input).root` — i.e. **the OS filesystem root (`/` on
POSIX)** — instead of the originally-requested `input` directory. The
requested directory is silently discarded and replaced with `/`.

This resolved `directory` becomes `location.directory`, which flows into
`packages/core/src/filesystem/search.ts` (`ripgrepLayer`, ~line 33-48):

```ts
yield* ripgrep
  .find({
    cwd: location.directory,
    pattern: "*",
    limit: location.vcs ? Number.MAX_SAFE_INTEGER : 100_000,
    onEntry: (entry) => Effect.sync(() => { state.files.push(entry.path); ... }),
  })
  .pipe(Effect.orDie, Effect.asVoid, Effect.forkIn(scope))
```

For any non-git directory, this forks a background scan of `cwd: "/"` (the
entire filesystem root, not the requested directory), capped at 100,000
entries, and populates `state.files`/`state.directories` asynchronously as
entries stream in. The synchronous `find()` query (fuzzysort over
`state.files`) runs against whatever has been indexed so far — for a query
issued moments after the dialog opens, that's effectively nothing, because
the scan is starting from `/` (macOS system root: `/System`, `/Library`,
`/Applications`, permission-walled directories, etc.) rather than the small
directory the user actually asked about. Hence "No folders found" with no
error, for any query, against any non-git directory — including `$HOME`.

## Reproduction

With `opencode web` running (`bun run --cwd packages/opencode
--conditions=browser src/index.ts web --port <any>`):

```bash
# Non-git directory (home) — returns [] regardless of query
curl -s "http://127.0.0.1:<port>/find/file?query=&dirs=true&limit=50&directory=%2FUsers%2F<user>"
# => []
curl -s "http://127.0.0.1:<port>/find/file?query=Doc&dirs=true&limit=50&directory=%2FUsers%2F<user>"
# => []

# Git-repo directory — works correctly, instant results
curl -s "http://127.0.0.1:<port>/find/file?query=&dirs=true&limit=20&directory=%2FUsers%2F<user>%2Fopencode"
# => [".gitignore", "packages/desktop/fork.ts", ...]
```

## Fix

In `packages/core/src/project.ts`, the no-repo fallback branch should keep
`directory: input` (the directory actually requested), not
`path.parse(input).root`. `id` staying `ID.global` and `vcs: undefined` for
the no-repo case is correct and should not change — only the `directory`
field is wrong.

```ts
if (!repo) return { id: ID.global, directory: input, vcs: undefined }
```

### Follow-on concern to verify after the fix

Once `directory` correctly stays scoped to the requested folder instead of
collapsing to `/`, `packages/core/src/filesystem/search.ts` will index that
folder with `limit: 100_000` (since `location.vcs` is still `undefined` for
a non-git directory — that branch of the ternary is unchanged). Confirm this
is an acceptable cap for a large non-git directory before considering this
fully fixed — 100,000 files is generally fine for a project folder, but if a
user points the picker at something like `$HOME` itself (which does have
real subfolders someone might reasonably want to open, even though it's not
itself a repo), the walk could still be slow. On this project's target
hardware (an 8GB 2014 MacBook Pro undergoing OpenCore Legacy Patcher
upgrade — see repo `HANDOFF.md` for context on why lightweight resource use
matters here), a manual `rg --files ~` against a real, fully-populated home
directory (cloud-sync folders, node_modules across many repos, Xcode/Library
caches) did not complete within 30 seconds in manual testing on a
comparable dev machine. Whether that's in scope for this fix or a separate
follow-up (e.g. excluding common heavy directories, or requiring the picker
to start one level below `$HOME`) is a judgment call — flag it, don't
silently scope-creep the fix to solve it.

## Out of scope / do not touch

- The literal-absolute-path breadcrumb resolution in the picker dialog
  (`packages/app/src/components/dialog-select-directory.tsx` and friends) —
  confirmed working, unrelated code path.
- `packages/core/src/filesystem/search.ts` ripgrep invocation shape for git
  repos (`location.vcs` truthy branch) — confirmed working, do not change.
- Anything under `packages/desktop/` — this bug is identical on desktop and
  web; do not add a desktop-only or web-only branch to work around it.

## Verification

1. `bun run --cwd packages/opencode --conditions=browser src/index.ts web
   --port <any>`
2. Open the web UI, click "Add project" with an empty search (defaults to
   `$HOME`).
3. Confirm real subfolders of `$HOME` now appear (not just git repos).
4. Confirm git-repo search (e.g. typing part of a repo name) still works
   and is not slower than before.
5. `curl` the two repro commands above and confirm the home-directory query
   now returns entries instead of `[]`.
