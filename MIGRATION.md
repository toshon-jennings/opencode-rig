# Migration to upstream 2.x
Branch `migrate-v2`, based on upstream `v2.2.5`. Replaces the 1.x-based line (`main`, upstream 1.19.5).
## Why
Zen rejects the 1.19.5-based Rig client for free models ("This version of OpenCode Desktop no longer supports free models"). Official Desktop 2.2.5 works with the same models, so the fork moves to 2.x.
## Method
Port the fork's changes onto 2.2.5 rather than merging ~5,900 upstream commits. Worklist = `git diff v1.19.5 HEAD` on `main` (fork-only changes), excluding `bun.lock` and i18n. i18n locale additions are handled last.
## Experiment result (verified)
A Desktop built from this branch (clean port applied) with the bundled CLI built as `OPENCODE_VERSION=2.2.5 OPENCODE_CHANNEL=latest` (User-Agent `opencode/latest/2.2.5/desktop`) gets free models. It was run as `OpenCode Beta` (`OPENCODE_CHANNEL=beta` for the desktop build) so it shared nothing with the official app. A first attempt under the prod channel was invalid: it shared bundle ID `ai.opencode.desktop` and the cached CLI folder with the official app.

## Identity (done, verified in a prod build)
- **User-Agent / version:** `packages/cli/script/build.ts` bakes `upstreamBase` (root `package.json`, via `Script.upstreamVersion`) as the CLI's version and `latest` as its channel, in the executable, the `package.json` the desktop reads, and the binary's default User-Agent. No env vars needed. The bundled CLI prints `opencode v2.2.5`; `opencode-cli.version` matches.
- **Rig version:** root and desktop `package.json` are `0.3.1` (above the 1.x-based 0.2.32, for the updater).
- **Bundle ID / name:** prod is `ai.opencode.desktop.rig` / "OpenCode Rig" (`electron-builder.config.ts`, `src/main/constants.ts`); dev and beta are "OpenCode Rig Dev/Beta". Linux metainfo files keep the upstream prod id. **Data moves:** Rig no longer shares `~/Library/Application Support/ai.opencode.desktop` with the official app, so Electron-side settings do not carry over (CLI data in `~/.local/share/opencode` is unaffected).
- **Update feed:** all channels use GitHub releases of `FORK_OWNER/FORK_REPO` (`packages/desktop/fork.ts`); prod is a draft until artifacts land. `script/pack.ts` now writes every publish field into `app-update.yml`.
- **CLI self-update:** the desktop sets `OPENCODE_DISABLE_AUTOUPDATE=true`, since a CLI reporting 2.2.5 would otherwise replace itself with the official release.
- **Signing:** opt-in; without Apple credentials the bundle is ad-hoc signed (`adhocSign`, run after anything that modifies the bundle). Verified with `codesign --verify --deep --strict`.
- **Not yet ported:** the updater's notify mode (`UPDATER_MODE`, `releasesUrl`), release workflows. (`resources/opencode-usage` is superseded by the usage plugin; the DMG is ported, see below.)

## Feature: usage panel (done, verified running in the prod Rig build)
`packages/gui-plugins/src/usage` is a built-in plugin: a typed contract, a main-process reader, a lazy side panel and an "Open usage" command. It replaces the fork's session-page panel, the `opencode-usage` shell script and its IPC/HTTP plumbing.
- **Data:** assistant messages live in two tables. 2.x copies the old `message` rows into `session_message` under the same ids, and 419 old messages exist only in the old table, so the query reads both and counts each id once (verified on this machine: 10,354 distinct ids, equal to the report's message total).
- **Per-channel databases:** like the fork, it sums every `opencode*.db` beside the main one.
- **Not ported:** the browser-client `/usage` HTTP route (the 2.x web client has no equivalent plugin host call yet); the fork's text-table parsing (the query returns JSON).
- **Lesson:** `ctx.use(contract)()` is `pending` until main is up; read it reactively, never once at mount.
- **Needs the `sqlite3` binary** on PATH (present on macOS).

## Feature: projectless sessions (done, verified running in the prod Rig build)
A "No project" row in the new-session location dialog (`new-session/location/dialog.tsx`, `new-session/project/{controller,selector}.tsx`) opens `~/no-project-chats` through the same `projects.add` + `selectProject` path as "Add project".
- **Why that folder:** it is where all 31 of the user's projectless sessions already ran (server project `global`). The fork's scratch folder (`~/.local/share/opencode/scratch`) was empty, and following it would need a protocol change plus a client regeneration.
- **Home directory:** read from the server's path info (`sync.data.path.home`), so it follows a remote server's home.
- **Folder must exist:** the renderer has no mkdir API. If the folder is missing, the add shows the server's error toast. It exists on this machine.
- **Strings:** `session.new.project.none` and `.none.hint` in `en.ts` only; other locales fall back to English.
- **Not ported:** the fork's `scratch-project.ts` label registry and `core/src/global.ts` scratch path.

## Feature: model selector (built and installed in the prod Rig build; the RIG mark confirmed by the user, the rest not yet checked on screen)
2.x already had collapsible provider groups (`ProviderModelGroup`), always-listed free models (`freeSet`) and a capability flyout (`details.tsx`), so only three things were ported.
- **Capability chips:** `providers/models/capabilities.ts` (pure tags) and `capability-badges.tsx` add a compact context size plus Reasoning, Vision and Tools badges to both picker row renderers in `select-dialog.tsx`. Strings `model.tag.{reasoning,vision,tools}` are in `en.ts` only. The fork's width change and `formatContextLimit` were not needed.
- **Default model:** `fallbackModels` in `providers/models/models.tsx` replaces the two "first model of first connected provider" fallbacks (`composer/selection.ts`, `providers/models/selection.tsx`). It prefers `opencode/deepseek-v4.1-flash-free`, then `glm-5.3-flash-free`. The fork's LongCat default was dropped: LongCat no longer works. It only applies with no configured or recent model, so existing history still wins.
- **Manage Models starts collapsed:** `providers/models/manage.tsx` keeps an `open` store; the Console group starts open.
- **Not ported:** the fork's `core/src/model-default.ts` (the app must not depend on Core), the tooltip changes, the `.every`/`.some` switch change, stories and the e2e spec.
- **Lesson:** the preferred model ids rot (LongCat did); missing ids are skipped, so a retired model degrades to the old fallback.

## Feature: Rig wordmark (done, confirmed by the user in the prod Rig build)
The fork put pixel "RIG" glyphs and a cursor in `wordmark-v2.tsx`, which 2.x no longer has. The new-session wordmark is a pinboard with geometry fixed to the 234×42 logo, so `RigMark` (now `@opencode/ui/rig-mark`) draws the glyphs as a separate mark under its right edge, mounted in `new-session/wordmark.tsx`.
- **Not ported:** the About page keeps the upstream "opencode" wordmark and its copyright line, which stay OpenCode's. The fork's settings footer ("OpenCode Desktop") has no 2.x counterpart.

## Feature: About OpenCode Rig page (done, viewed running in the prod Rig build)
A separate settings page below About, so upstream's About files stay untouched: the built-in plugin `gui-plugins/src/rig` adds a `SettingsPage` in the `about` group (`renderer.tsx`, `page.tsx`, `i18n/en.ts`) and is listed in `gui-plugins/src/renderer.ts`. It shows the Rig version, "Based on OpenCode <upstreamBase>", and a diff-style ledger of what differs (`+` added, `~` changed).
- **Upstream version:** `electron.vite.config.ts` defines `import.meta.env.OPENCODE_UPSTREAM_VERSION` from the root `package.json` `upstreamBase` (typed in `gui-plugins/src/env.d.ts`).
- **RIG mark:** moved to `@opencode/ui/rig-mark` (`ui/src/typography/rig-mark`) so the plugin and the new-session wordmark share it.
- **Direction:** the pixel mark is the one bold element; a ruled list, no cards, no new accent hue, host theme tokens only. The differences list is hand-written: update it when a feature lands.
- **Lesson:** the About page itself stays OpenCode's (credits, license, trademark, copyright); never brand it.

## Feature: styled DMG (built and mounted; the result of `bun run dmg` was inspected, not yet shipped)
The fork's artwork (`build/background.{png,svg}`, `make-background.py`, `DMG-ARTWORK-BRIEF.md`, `fix-dmg-background.sh`) is copied unchanged: it is already derived from the Rig brand ("the prompt is the arrow"). A shared `dmg` block in `electron-builder.config.ts` (540×380, icons at 140/400,225) is kept by the prod override.
- **Command:** `OPENCODE_CHANNEL=prod bun run dmg` in `packages/desktop` builds `dist/*.dmg` and runs the Finder fix. 2.x's `pack` only tars the `.app`, so the DMG is a separate step.
- **Verified:** the mounted volume is HFS+ with a 728-byte Finder-written alias, `.background/background.png` is a 540×380 PNG, the window bounds are 540×380, and the background renders (not grey). Label luminance 0.611 / 0.627. Light/Dark was checked in the mockup only; the system appearance was not toggled on the live window.
- **Needs Finder automation permission** for the fix script.
- **Not done:** the release workflows still do not run the fix after `--publish`; none are ported yet.
- **Regression test:** `electron-builder.config.test.ts` asserts a single PNG at the window size and no `@2x` beside it.

## Test notes
- Run app tests with `bun run test:unit` (a bare `bun test` skips the solid conditions and fails to load). `bootstrap.test.ts` "recovers project metadata after the connection to the server is dropped" fails on the untouched baseline too.

## Open questions
- Which of the 152 `gone-in-v2` files are fork features vs. upstream code the fork merely touched?
## Findings so far
- `packages/opencode` no longer exists in 2.2.5; its code moved into `packages/core` / `packages/cli`. Its 25 fork-touched files (e.g. `session/llm/request.ts`, which held `ZEN_USER_AGENT`) must be re-found in the new layout.
- 2.x builds the Zen request headers in `packages/core/src/session/model-request.ts` (`x-opencode-client`) and `packages/core/src/plugin/provider/opencode.ts` (User-Agent).
- 63 of the `gone-in-v2` files are in `packages/app/src`, so the app UI was reorganized; check which are fork features.

## Counts
| Category | Files | Action |
|---|---|---|
| clean | 166 | Port as-is |
| added-by-fork/path-free | 68 | Copy over |
| added-by-fork/path-taken | 1 | Merge by hand |
| conflict | 75 | Re-apply by hand |
| gone-in-v2 | 152 | Find the 2.x equivalent |
| deleted-by-fork | 40 | Decide |

## clean (166)
Fork changed it; upstream did not touch it 1.19.5→2.2.5. `git apply` the fork diff.

- [x] `packages/console/app/src/asset/logo-ornate-dark.svg`
- [x] `packages/console/app/src/asset/logo-ornate-light.svg`
- [x] `packages/desktop/.gitignore`
- [x] `packages/desktop/icons/beta/128x128.png`
- [x] `packages/desktop/icons/beta/128x128@2x.png`
- [x] `packages/desktop/icons/beta/32x32.png`
- [x] `packages/desktop/icons/beta/64x64.png`
- [x] `packages/desktop/icons/beta/Square107x107Logo.png`
- [x] `packages/desktop/icons/beta/Square142x142Logo.png`
- [x] `packages/desktop/icons/beta/Square150x150Logo.png`
- [x] `packages/desktop/icons/beta/Square284x284Logo.png`
- [x] `packages/desktop/icons/beta/Square30x30Logo.png`
- [x] `packages/desktop/icons/beta/Square310x310Logo.png`
- [x] `packages/desktop/icons/beta/Square44x44Logo.png`
- [x] `packages/desktop/icons/beta/Square71x71Logo.png`
- [x] `packages/desktop/icons/beta/Square89x89Logo.png`
- [x] `packages/desktop/icons/beta/StoreLogo.png`
- [x] `packages/desktop/icons/beta/android/mipmap-hdpi/ic_launcher.png`
- [x] `packages/desktop/icons/beta/android/mipmap-hdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/beta/android/mipmap-hdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/beta/android/mipmap-mdpi/ic_launcher.png`
- [x] `packages/desktop/icons/beta/android/mipmap-mdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/beta/android/mipmap-mdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/beta/android/mipmap-xhdpi/ic_launcher.png`
- [x] `packages/desktop/icons/beta/android/mipmap-xhdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/beta/android/mipmap-xhdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/beta/android/mipmap-xxhdpi/ic_launcher.png`
- [x] `packages/desktop/icons/beta/android/mipmap-xxhdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/beta/android/mipmap-xxhdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/beta/android/mipmap-xxxhdpi/ic_launcher.png`
- [x] `packages/desktop/icons/beta/android/mipmap-xxxhdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/beta/android/mipmap-xxxhdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/beta/icon.ico`
- [x] `packages/desktop/icons/beta/icon.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-20x20@1x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-20x20@2x-1.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-20x20@2x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-20x20@3x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-29x29@1x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-29x29@2x-1.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-29x29@2x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-29x29@3x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-40x40@1x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-40x40@2x-1.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-40x40@2x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-40x40@3x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-512@2x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-60x60@2x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-60x60@3x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-76x76@1x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-76x76@2x.png`
- [x] `packages/desktop/icons/beta/ios/AppIcon-83.5x83.5@2x.png`
- [x] `packages/desktop/icons/dev/128x128.png`
- [x] `packages/desktop/icons/dev/128x128@2x.png`
- [x] `packages/desktop/icons/dev/32x32.png`
- [x] `packages/desktop/icons/dev/64x64.png`
- [x] `packages/desktop/icons/dev/Square107x107Logo.png`
- [x] `packages/desktop/icons/dev/Square142x142Logo.png`
- [x] `packages/desktop/icons/dev/Square150x150Logo.png`
- [x] `packages/desktop/icons/dev/Square284x284Logo.png`
- [x] `packages/desktop/icons/dev/Square30x30Logo.png`
- [x] `packages/desktop/icons/dev/Square310x310Logo.png`
- [x] `packages/desktop/icons/dev/Square44x44Logo.png`
- [x] `packages/desktop/icons/dev/Square71x71Logo.png`
- [x] `packages/desktop/icons/dev/Square89x89Logo.png`
- [x] `packages/desktop/icons/dev/StoreLogo.png`
- [x] `packages/desktop/icons/dev/android/mipmap-hdpi/ic_launcher.png`
- [x] `packages/desktop/icons/dev/android/mipmap-hdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/dev/android/mipmap-hdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/dev/android/mipmap-mdpi/ic_launcher.png`
- [x] `packages/desktop/icons/dev/android/mipmap-mdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/dev/android/mipmap-mdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/dev/android/mipmap-xhdpi/ic_launcher.png`
- [x] `packages/desktop/icons/dev/android/mipmap-xhdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/dev/android/mipmap-xhdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/dev/android/mipmap-xxhdpi/ic_launcher.png`
- [x] `packages/desktop/icons/dev/android/mipmap-xxhdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/dev/android/mipmap-xxhdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/dev/android/mipmap-xxxhdpi/ic_launcher.png`
- [x] `packages/desktop/icons/dev/android/mipmap-xxxhdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/dev/android/mipmap-xxxhdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/dev/icon.ico`
- [x] `packages/desktop/icons/dev/icon.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-20x20@1x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-20x20@2x-1.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-20x20@2x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-20x20@3x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-29x29@1x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-29x29@2x-1.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-29x29@2x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-29x29@3x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-40x40@1x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-40x40@2x-1.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-40x40@2x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-40x40@3x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-512@2x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-60x60@2x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-60x60@3x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-76x76@1x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-76x76@2x.png`
- [x] `packages/desktop/icons/dev/ios/AppIcon-83.5x83.5@2x.png`
- [x] `packages/desktop/icons/prod/128x128.png`
- [x] `packages/desktop/icons/prod/128x128@2x.png`
- [x] `packages/desktop/icons/prod/32x32.png`
- [x] `packages/desktop/icons/prod/64x64.png`
- [x] `packages/desktop/icons/prod/Square107x107Logo.png`
- [x] `packages/desktop/icons/prod/Square142x142Logo.png`
- [x] `packages/desktop/icons/prod/Square150x150Logo.png`
- [x] `packages/desktop/icons/prod/Square284x284Logo.png`
- [x] `packages/desktop/icons/prod/Square30x30Logo.png`
- [x] `packages/desktop/icons/prod/Square310x310Logo.png`
- [x] `packages/desktop/icons/prod/Square44x44Logo.png`
- [x] `packages/desktop/icons/prod/Square71x71Logo.png`
- [x] `packages/desktop/icons/prod/Square89x89Logo.png`
- [x] `packages/desktop/icons/prod/StoreLogo.png`
- [x] `packages/desktop/icons/prod/android/mipmap-hdpi/ic_launcher.png`
- [x] `packages/desktop/icons/prod/android/mipmap-hdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/prod/android/mipmap-hdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/prod/android/mipmap-mdpi/ic_launcher.png`
- [x] `packages/desktop/icons/prod/android/mipmap-mdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/prod/android/mipmap-mdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/prod/android/mipmap-xhdpi/ic_launcher.png`
- [x] `packages/desktop/icons/prod/android/mipmap-xhdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/prod/android/mipmap-xhdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/prod/android/mipmap-xxhdpi/ic_launcher.png`
- [x] `packages/desktop/icons/prod/android/mipmap-xxhdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/prod/android/mipmap-xxhdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/prod/android/mipmap-xxxhdpi/ic_launcher.png`
- [x] `packages/desktop/icons/prod/android/mipmap-xxxhdpi/ic_launcher_foreground.png`
- [x] `packages/desktop/icons/prod/android/mipmap-xxxhdpi/ic_launcher_round.png`
- [x] `packages/desktop/icons/prod/icon.ico`
- [x] `packages/desktop/icons/prod/icon.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-20x20@1x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-20x20@2x-1.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-20x20@2x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-20x20@3x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-29x29@1x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-29x29@2x-1.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-29x29@2x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-29x29@3x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-40x40@1x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-40x40@2x-1.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-40x40@2x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-40x40@3x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-512@2x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-60x60@2x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-60x60@3x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-76x76@1x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-76x76@2x.png`
- [x] `packages/desktop/icons/prod/ios/AppIcon-83.5x83.5@2x.png`
- [x] `packages/stats/app/src/asset/logo-ornate-dark.svg`
- [x] `packages/stats/app/src/asset/logo-ornate-light.svg`
- [x] `packages/stats/core/src/domain/home.ts`
- [x] `packages/ui/src/assets/favicon/apple-touch-icon-v3.png`
- [x] `packages/ui/src/assets/favicon/apple-touch-icon.png`
- [x] `packages/ui/src/assets/favicon/favicon-96x96-v3.png`
- [x] `packages/ui/src/assets/favicon/favicon-96x96.png`
- [x] `packages/ui/src/assets/favicon/favicon-v3.ico`
- [x] `packages/ui/src/assets/favicon/favicon-v3.svg`
- [x] `packages/ui/src/assets/favicon/favicon.ico`
- [x] `packages/ui/src/assets/favicon/favicon.svg`
- [x] `packages/ui/src/assets/favicon/site.webmanifest`
- [x] `packages/ui/src/assets/favicon/web-app-manifest-192x192.png`
- [x] `packages/ui/src/assets/favicon/web-app-manifest-512x512.png`
- [x] `packages/ui/src/components/favicon.tsx`
- [x] `packages/ui/src/components/logo.tsx`

## added-by-fork/path-free (68)
New fork file; path is free in v2.2.5. Copy, then fix imports against 2.x.

- [ ] `.claude/launch.json`
- [ ] `.github/workflows/upstream-scan.yml`
- [ ] `assets/logo-rig-dark.svg`
- [ ] `assets/logo-rig-light.svg`
- [ ] `assets/og-image.html`
- [ ] `assets/og-image.png`
- [ ] `docs/claude-cli-conversation-check.json`
- [ ] `docs/review-v2-hunk-staging.md`
- [ ] `packages/app/src/components/dialog-select-mcp-helpers.test.ts`
- [ ] `packages/app/src/components/dialog-select-mcp-helpers.ts`
- [ ] `packages/app/src/components/dialog-select-mcp.stories.tsx`
- [ ] `packages/app/src/components/model-capability-chips.stories.tsx`
- [ ] `packages/app/src/components/model-capability-tags.test.ts`
- [x] `packages/app/src/components/model-capability-tags.ts` — ported as `providers/models/capabilities.ts`
- [ ] `packages/app/src/components/prompt-input/context-items.stories.tsx`
- [ ] `packages/app/src/components/settings-v2/parts/models-group-trigger.stories.tsx`
- [ ] `packages/app/src/components/settings-v2/parts/models-group-trigger.tsx`
- [ ] `packages/app/src/context/provider-health-sync.ts`
- [ ] `packages/app/src/context/provider-health.test.ts`
- [ ] `packages/app/src/context/provider-health.ts`
- [ ] `packages/app/src/pages/session/github-overview-tab.tsx`
- [ ] `packages/app/src/pages/session/terminal-mount.ts`
- [ ] `packages/app/src/pages/session/timeline/steer-chip.stories.tsx`
- [ ] `packages/app/src/pages/session/timeline/steer-chip.tsx`
- [x] `packages/app/src/pages/session/usage-panel.tsx` — ported as `packages/gui-plugins/src/usage/panel.tsx`
- [x] `packages/app/src/utils/scratch-project.ts` (superseded: see "projectless sessions")
- [ ] `packages/app/src/utils/terminal-modes.test.ts`
- [ ] `packages/app/src/utils/terminal-modes.ts`
- [ ] `packages/app/test-browser/terminal-mode-restore.test.ts`
- [ ] `packages/app/test-browser/terminal-mount.test.ts`
- [ ] `packages/core/script/verify-claude-conversation.ts`
- [ ] `packages/core/src/cli-agent-language-model.ts`
- [ ] `packages/core/src/cli-auth.ts`
- [ ] `packages/core/src/github-overview.ts`
- [ ] `packages/core/src/model-default.ts`
- [ ] `packages/core/src/plugin/provider/cli-agents.ts`
- [ ] `packages/core/src/plugin/provider/command-code.ts`
- [ ] `packages/core/src/review.ts`
- [ ] `packages/core/test/cli-agent-language-model.test.ts`
- [ ] `packages/core/test/cli-node-runtime.test.ts`
- [ ] `packages/core/test/model-default.test.ts`
- [ ] `packages/core/test/review.test.ts`
- [ ] `packages/desktop/build/DMG-ARTWORK-BRIEF.md`
- [ ] `packages/desktop/build/background.png`
- [ ] `packages/desktop/build/background.svg`
- [ ] `packages/desktop/build/fix-dmg-background.sh`
- [ ] `packages/desktop/build/make-background.py`
- [ ] `packages/desktop/build/refresh-update-feed.py`
- [ ] `packages/desktop/fork.ts`
- [x] `packages/desktop/resources/opencode-usage` — superseded: the query lives in `gui-plugins/src/usage/query.ts`
- [ ] `packages/llm/test/protocols/shared.test.ts`
- [ ] `packages/opencode/src/plugin/cli-providers.ts`
- [ ] `packages/opencode/src/plugin/deepinfra.ts`
- [ ] `packages/opencode/src/util/random.ts`
- [ ] `packages/opencode/test/util/random.test.ts`
- [ ] `packages/protocol/src/groups/github-overview.ts`
- [ ] `packages/protocol/src/groups/review.ts`
- [ ] `packages/schema/src/github-overview.ts`
- [ ] `packages/schema/src/review.ts`
- [ ] `packages/schema/test/github-overview.test.ts`
- [ ] `packages/sdk/js/test/params-security.test.ts`
- [ ] `packages/sdk/js/test/review-client.test.ts`
- [ ] `packages/server/src/handlers/github-overview.ts`
- [ ] `packages/server/src/handlers/review.ts`
- [ ] `packages/ui/src/components/resize-handle.test.ts`
- [ ] `packages/ui/src/v2/components/tooltip-v2.test.ts`
- [ ] `script/upstream-scan.ts`
- [ ] `specs/fix-non-git-project-picker.md`

## added-by-fork/path-taken (1)
New fork file, but upstream now has a file at that path.

- [ ] `.github/workflows/release.yml`

## conflict (75)
Both sides changed it. Many are only version bumps in package.json (trivial); the rest need real merging.

- [ ] `.gitignore`
- [ ] `.opencode/tool/github-pr-search.ts`
- [ ] `README.md`
- [ ] `package.json`
- [ ] `packages/app/e2e/user-story/model-selection-flow.spec.ts`
- [ ] `packages/app/index.html`
- [ ] `packages/app/package.json`
- [ ] `packages/app/src/app.tsx`
- [ ] `packages/app/src/entry.tsx`
- [ ] `packages/cli/package.json`
- [ ] `packages/cli/script/build.ts`
- [ ] `packages/codemode/package.json`
- [ ] `packages/console/app/package.json`
- [ ] `packages/core/package.json`
- [ ] `packages/core/src/filesystem/search.ts`
- [ ] `packages/core/src/git.ts`
- [ ] `packages/core/src/integration.ts`
- [ ] `packages/core/src/integration/connection.ts`
- [ ] `packages/core/src/location-services.ts`
- [ ] `packages/core/src/plugin/host.ts`
- [ ] `packages/core/src/plugin/provider.ts`
- [ ] `packages/core/src/plugin/provider/github-copilot.ts`
- [ ] `packages/core/src/project.ts`
- [ ] `packages/core/test/catalog.test.ts`
- [ ] `packages/core/test/filesystem/search.test.ts`
- [ ] `packages/core/test/integration.test.ts`
- [ ] `packages/core/test/plugin/host.ts`
- [ ] `packages/core/test/project.test.ts`
- [ ] `packages/desktop/electron-builder.config.test.ts`
- [ ] `packages/desktop/electron-builder.config.ts`
- [ ] `packages/desktop/icons/beta/dock.png`
- [ ] `packages/desktop/icons/beta/icon.icns`
- [ ] `packages/desktop/icons/dev/dock.png`
- [ ] `packages/desktop/icons/dev/icon.icns`
- [ ] `packages/desktop/icons/prod/dock.png`
- [ ] `packages/desktop/icons/prod/icon.icns`
- [ ] `packages/desktop/package.json`
- [ ] `packages/desktop/src/main/constants.ts`
- [ ] `packages/desktop/src/main/env.d.ts`
- [ ] `packages/desktop/src/main/index.ts`
- [x] `packages/desktop/src/main/ipc.ts` — usage-only change, superseded by the `usage` plugin contract
- [x] `packages/desktop/src/preload/index.ts` — usage-only change, superseded
- [x] `packages/desktop/src/preload/types.ts` — usage-only change, superseded
- [ ] `packages/desktop/src/renderer/index.html`
- [ ] `packages/desktop/src/renderer/index.tsx`
- [ ] `packages/function/package.json`
- [ ] `packages/http-recorder/package.json`
- [ ] `packages/plugin/package.json`
- [ ] `packages/protocol/src/api.ts`
- [ ] `packages/schema/src/connection.ts`
- [ ] `packages/schema/src/index.ts`
- [ ] `packages/schema/src/integration.ts`
- [ ] `packages/script/src/index.ts`
- [ ] `packages/server/package.json`
- [ ] `packages/server/src/handlers.ts`
- [ ] `packages/session-ui/package.json`
- [ ] `packages/session-ui/src/components/line-comment-annotations.tsx`
- [ ] `packages/session-ui/src/components/line-comment.tsx`
- [ ] `packages/session-ui/src/v2/components/line-comment-annotations-v2.tsx`
- [ ] `packages/session-ui/src/v2/components/session-review-file-preview-v2.tsx`
- [ ] `packages/session-ui/src/v2/components/session-review-v2.css`
- [ ] `packages/session-ui/src/v2/components/session-review-v2.tsx`
- [ ] `packages/stats/app/package.json`
- [ ] `packages/stats/app/src/routes/index.tsx`
- [ ] `packages/stats/core/package.json`
- [ ] `packages/stats/server/package.json`
- [ ] `packages/tui/package.json`
- [ ] `packages/tui/src/component/error-component.tsx`
- [ ] `packages/tui/src/context/local.tsx`
- [ ] `packages/ui/package.json`
- [ ] `packages/ui/src/components/resize-handle.css`
- [ ] `packages/web/package.json`
- [ ] `packages/web/src/components/Hero.astro`
- [ ] `packages/web/src/content/docs/providers.mdx`
- [ ] `sdks/vscode/package.json`

## gone-in-v2 (152)
File no longer exists in 2.2.5 (moved/rewritten). Decide per file: re-implement, already provided by 2.x, or drop.

- [ ] `.github/workflows/storybook.yml`
- [ ] `.github/workflows/test.yml`
- [ ] `.github/workflows/typecheck.yml`
- [ ] `.opencode/tool/github-triage.ts`
- [ ] `github/index.ts`
- [ ] `packages/app/src/components/dialog-connect-provider.tsx`
- [ ] `packages/app/src/components/dialog-manage-models.tsx`
- [ ] `packages/app/src/components/dialog-select-mcp.tsx`
- [ ] `packages/app/src/components/dialog-select-model.tsx`
- [ ] `packages/app/src/components/model-tooltip.tsx`
- [ ] `packages/app/src/components/prompt-input-v2.tsx`
- [ ] `packages/app/src/components/prompt-input.tsx`
- [ ] `packages/app/src/components/prompt-input/context-items.tsx`
- [ ] `packages/app/src/components/prompt-input/submit.test.ts`
- [ ] `packages/app/src/components/prompt-input/submit.ts`
- [ ] `packages/app/src/components/session/session-context-breakdown.ts`
- [ ] `packages/app/src/components/settings-providers.tsx`
- [ ] `packages/app/src/components/settings-v2/models.tsx`
- [ ] `packages/app/src/components/settings-v2/providers.tsx`
- [ ] `packages/app/src/components/settings-v2/settings-v2.css`
- [ ] `packages/app/src/components/status-popover-body.tsx`
- [ ] `packages/app/src/components/status-popover-indicator.test.ts`
- [ ] `packages/app/src/components/status-popover-indicator.ts`
- [ ] `packages/app/src/components/status-popover.tsx`
- [ ] `packages/app/src/components/terminal.tsx`
- [ ] `packages/app/src/components/titlebar-tab-nav.tsx`
- [ ] `packages/app/src/components/titlebar-tab-strip.tsx`
- [ ] `packages/app/src/context/global-sync/bootstrap.test.ts`
- [ ] `packages/app/src/context/global-sync/bootstrap.ts`
- [ ] `packages/app/src/context/global-sync/child-store.ts`
- [ ] `packages/app/src/context/global.tsx`
- [ ] `packages/app/src/context/language.tsx`
- [ ] `packages/app/src/context/layout-tabs.ts`
- [ ] `packages/app/src/context/layout.tsx`
- [ ] `packages/app/src/context/models.tsx`
- [x] `packages/app/src/context/platform.tsx` — usage-only change, superseded
- [ ] `packages/app/src/context/prompt-state.test.ts`
- [ ] `packages/app/src/context/prompt-state.ts`
- [ ] `packages/app/src/context/prompt.tsx`
- [ ] `packages/app/src/context/server-session.ts`
- [ ] `packages/app/src/context/server-sync.tsx`
- [ ] `packages/app/src/context/settings.tsx`
- [ ] `packages/app/src/context/tabs.tsx`
- [ ] `packages/app/src/context/terminal.test.ts`
- [ ] `packages/app/src/context/terminal.tsx`
- [ ] `packages/app/src/desktop-menu.ts`
- [ ] `packages/app/src/pages/home/home-controller.ts`
- [ ] `packages/app/src/pages/home/home-projects-controller.tsx`
- [ ] `packages/app/src/pages/home/home-projects-view.tsx`
- [ ] `packages/app/src/pages/home/home-projects.tsx`
- [ ] `packages/app/src/pages/home/home-sessions-controller.tsx`
- [ ] `packages/app/src/pages/layout.tsx`
- [ ] `packages/app/src/pages/layout/helpers.test.ts`
- [ ] `packages/app/src/pages/layout/helpers.ts`
- [ ] `packages/app/src/pages/session.tsx`
- [ ] `packages/app/src/pages/session/composer/prompt-model-selection.ts`
- [ ] `packages/app/src/pages/session/helpers.test.ts`
- [ ] `packages/app/src/pages/session/helpers.ts`
- [ ] `packages/app/src/pages/session/session-side-panel.tsx`
- [ ] `packages/app/src/pages/session/terminal-panel-v2.tsx`
- [ ] `packages/app/src/pages/session/terminal-panel.tsx`
- [ ] `packages/app/src/pages/session/timeline/message-timeline.tsx`
- [ ] `packages/app/src/pages/session/v2/review-diff-kinds.test.ts`
- [ ] `packages/app/src/pages/session/v2/review-diff-kinds.ts`
- [ ] `packages/app/src/pages/session/v2/review-panel-v2-state.ts`
- [ ] `packages/app/src/pages/session/v2/review-panel-v2.tsx`
- [ ] `packages/app/src/utils/runtime-adapters.ts`
- [ ] `packages/app/src/utils/server-compat.ts`
- [ ] `packages/client/src/generated-effect/client.ts`
- [ ] `packages/client/src/generated/client.ts`
- [ ] `packages/client/src/generated/types.ts`
- [ ] `packages/console/app/src/routes/workspace/common.tsx`
- [ ] `packages/console/core/package.json`
- [ ] `packages/console/core/script/promote-models.ts`
- [ ] `packages/console/core/script/pull-models.ts`
- [ ] `packages/console/core/script/update-models.ts`
- [ ] `packages/console/function/package.json`
- [ ] `packages/console/mail/package.json`
- [ ] `packages/console/support/package.json`
- [ ] `packages/core/src/catalog.ts`
- [ ] `packages/core/src/global.ts`
- [ ] `packages/core/src/installation/version.ts`
- [ ] `packages/core/src/plugin/provider/deepinfra.ts`
- [ ] `packages/core/test/plugin/provider-deepinfra.test.ts`
- [ ] `packages/desktop/scripts/copy-metainfo.ts`
- [ ] `packages/desktop/src/main/background-cli.ts`
- [ ] `packages/desktop/src/main/server.ts`
- [ ] `packages/desktop/src/main/sidecar.ts`
- [ ] `packages/desktop/src/main/updater-controller.ts`
- [ ] `packages/desktop/src/main/updater.ts`
- [ ] `packages/desktop/src/main/windows.ts`
- [ ] `packages/effect-drizzle-sqlite/package.json`
- [ ] `packages/effect-sqlite-node/package.json`
- [ ] `packages/enterprise/package.json`
- [ ] `packages/enterprise/vite.config.ts`
- [ ] `packages/llm/package.json`
- [ ] `packages/llm/script/recording-cost-report.ts`
- [ ] `packages/llm/src/protocols/shared.ts`
- [ ] `packages/llm/src/provider-error.ts`
- [ ] `packages/llm/test/provider-error.test.ts`
- [ ] `packages/opencode/package.json`
- [ ] `packages/opencode/script/build-node.ts`
- [ ] `packages/opencode/script/build.ts`
- [ ] `packages/opencode/script/publish.ts`
- [ ] `packages/opencode/src/acp/tool.ts`
- [ ] `packages/opencode/src/cli/cmd/github.handler.ts`
- [ ] `packages/opencode/src/cli/cmd/run.ts`
- [ ] `packages/opencode/src/id/id.ts`
- [ ] `packages/opencode/src/lsp/server.ts`
- [ ] `packages/opencode/src/plugin/github-copilot/copilot.ts`
- [ ] `packages/opencode/src/plugin/index.ts`
- [ ] `packages/opencode/src/plugin/openai/codex.ts`
- [ ] `packages/opencode/src/plugin/snowflake-cortex.ts`
- [ ] `packages/opencode/src/provider/provider.ts`
- [ ] `packages/opencode/src/server/routes/instance/httpapi/groups/instance.ts`
- [ ] `packages/opencode/src/server/routes/instance/httpapi/handlers/instance.ts`
- [x] `packages/opencode/src/server/routes/instance/httpapi/server.ts` — usage-only change (`/usage` route), superseded
- [ ] `packages/opencode/src/session/llm/request.ts`
- [ ] `packages/opencode/src/util/archive.ts`
- [ ] `packages/opencode/test/acp/tool.test.ts`
- [ ] `packages/opencode/test/auth/auth.test.ts`
- [ ] `packages/opencode/test/config/config.test.ts`
- [ ] `packages/opencode/test/lsp/jdtls-root.test.ts`
- [ ] `packages/opencode/test/provider/provider.test.ts`
- [ ] `packages/opencode/test/server/httpapi-sdk.test.ts`
- [ ] `packages/plugin/src/index.ts`
- [ ] `packages/plugin/src/v2/effect/integration.ts`
- [ ] `packages/sdk/js/package.json`
- [ ] `packages/sdk/js/script/build.ts`
- [ ] `packages/sdk/js/src/v2/client.ts`
- [ ] `packages/sdk/js/src/v2/gen/client/client.gen.ts`
- [ ] `packages/sdk/js/src/v2/gen/client/types.gen.ts`
- [ ] `packages/sdk/js/src/v2/gen/client/utils.gen.ts`
- [ ] `packages/sdk/js/src/v2/gen/core/bodySerializer.gen.ts`
- [ ] `packages/sdk/js/src/v2/gen/core/params.gen.ts`
- [ ] `packages/sdk/js/src/v2/gen/core/serverSentEvents.gen.ts`
- [ ] `packages/sdk/js/src/v2/gen/core/types.gen.ts`
- [ ] `packages/sdk/js/src/v2/gen/core/utils.gen.ts`
- [ ] `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- [ ] `packages/sdk/js/src/v2/gen/types.gen.ts`
- [ ] `packages/sdk/openapi.json`
- [ ] `packages/session-ui/src/v2/components/prompt-input/index.tsx`
- [ ] `packages/session-ui/src/v2/components/prompt-input/types.ts`
- [ ] `packages/slack/package.json`
- [ ] `packages/tui/src/context/project.tsx`
- [ ] `packages/ui/src/components/icon.tsx`
- [ ] `packages/ui/src/v2/components/icon.tsx`
- [ ] `packages/ui/src/v2/components/line-comment-v2.tsx`
- [ ] `packages/ui/src/v2/components/tooltip-v2.css`
- [ ] `packages/ui/src/v2/components/wordmark-v2.tsx`
- [ ] `packages/web/src/assets/logo-ornate-dark.svg`
- [ ] `packages/web/src/assets/logo-ornate-light.svg`

## deleted-by-fork (40)
Fork deleted it (CI workflows, translated READMEs). Repeat the deletion only if still wanted.

- [ ] `.github/workflows/close-issues.yml`
- [ ] `.github/workflows/close-prs.yml`
- [ ] `.github/workflows/compliance-close.yml`
- [ ] `.github/workflows/containers.yml`
- [ ] `.github/workflows/deploy.yml`
- [ ] `.github/workflows/docs-update.yml`
- [ ] `.github/workflows/duplicate-issues.yml`
- [ ] `.github/workflows/nix-eval.yml`
- [ ] `.github/workflows/notify-discord.yml`
- [ ] `.github/workflows/opencode.yml`
- [ ] `.github/workflows/pr-management.yml`
- [ ] `.github/workflows/pr-standards.yml`
- [ ] `.github/workflows/publish-github-action.yml`
- [ ] `.github/workflows/publish-vscode.yml`
- [ ] `.github/workflows/publish.yml`
- [ ] `.github/workflows/release-github-action.yml`
- [ ] `.github/workflows/review.yml`
- [ ] `.github/workflows/stats.yml`
- [ ] `.github/workflows/triage.yml`
- [ ] `README.ar.md`
- [ ] `README.bn.md`
- [ ] `README.br.md`
- [ ] `README.bs.md`
- [ ] `README.da.md`
- [ ] `README.de.md`
- [ ] `README.es.md`
- [ ] `README.fr.md`
- [ ] `README.gr.md`
- [ ] `README.it.md`
- [ ] `README.ja.md`
- [ ] `README.ko.md`
- [ ] `README.no.md`
- [ ] `README.pl.md`
- [ ] `README.ru.md`
- [ ] `README.th.md`
- [ ] `README.tr.md`
- [ ] `README.uk.md`
- [ ] `README.vi.md`
- [ ] `README.zh.md`
- [ ] `README.zht.md`
