Community fork of OpenCode adding providers that drive your signed-in Codex and Claude CLIs, an integrated terminal, and a persistent usage dashboard. Not affiliated with the OpenCode team.

---

![opencode-rig logo](assets/logo-rig-light.svg)

OpenCode Rig — an unofficial fork of the open source AI coding agent.

[github.com/toshon-jennings/opencode-rig](https://github.com/toshon-jennings/opencode-rig)

> \[!IMPORTANT\] **This is an unofficial community fork.** It is not built, maintained, endorsed, or supported by the OpenCode team, and it is not affiliated with them in any way.
>
> Please do not file issues about this fork on the upstream tracker, and do not ask the OpenCode maintainers for support with it. Report problems with this fork at [toshon-jennings/opencode-rig/issues](https://github.com/toshon-jennings/opencode-rig/issues).
>
> For the official project, see [opencode.ai](https://opencode.ai) and [anomalyco/opencode](https://github.com/anomalyco/opencode). "OpenCode" and the OpenCode logo belong to their respective owners; the mark above is a modified version used only to distinguish this fork.

### What this fork isn't

- **Not a rewrite.** This tracks upstream opencode; almost everything you see is theirs,
  and upstream changes land here. What the fork adds is the usage panel, the integrated
  terminal, and providers that drive your local Codex and Claude CLIs.
- **Not a credential manager.** The `codex-cli` and `claude-cli` providers only appear
  if those CLIs are installed and already signed in — the fork shells out to
  `codex login status` and `claude auth status --json` to check, then runs the local
  binary. It spends the login you already have; it never stores or brokers one.
- **Not available everywhere in the app.** The usage panel needs local command
  execution, so it is desktop only. Web builds render nothing where it would be.
- **Not a support channel for upstream.** See the note above: issues with this fork go
  to this repo, never to the OpenCode team.

### What this fork adds

#### Persistent usage dashboard

A panel pinned across the bottom of the session view, reporting per model: messages, input / output / reasoning tokens, cache reads and writes, and cost — plus a `TOTAL` row.

- **Always visible.** No toggle, keybind, or slash command — it is part of the session layout, like the message timeline or the prompt input.
- **Live.** Refreshes every 30 seconds and on mount, with a last-updated stamp in the header and a manual **Refresh** button.
- **Resizable.** Drag its top edge; the height persists across restarts.
- **Quiet on failure.** If the underlying command is missing or errors, the panel shows a muted message instead of breaking the session view.
- **Desktop only.** Web builds render nothing, since the panel needs local command execution.

#### Integrated terminal

A terminal available directly in the session view, kept alongside the usage dashboard in the same layout so you can run commands without leaving the conversation.

#### CLI agent providers

Two extra providers — **Codex CLI** and **Claude CLI** — that answer prompts by running the official `codex` and `claude` binaries already installed and signed in on your machine.

- **Models.** Codex CLI serves GPT-5.6 Sol, Terra, and Luna; Claude CLI serves Claude Fable 5, Opus 5, Sonnet 5, and Haiku 4.5.
- **Only appear when detected.** At startup the fork runs `codex login status` and `claude auth status --json`; each provider registers only if its check passes. With the CLI missing or signed out, the provider is simply absent from the model list — no error, no empty entry to click.
- **Read-only by construction.** Claude runs with `--safe-mode --permission-mode plan --tools ""` and no session persistence; Codex runs its `app-server` with `sandbox: read-only`, `approvalPolicy: never`, and an ephemeral thread. Neither can edit files or run commands.
- **Text in, text out.** Both register with tool calling off, so OpenCode's tool registry is never handed to them — they answer, they don't act. Each request is one-shot: the conversation so far is flattened into a single prompt.
- **No token accounting.** The CLIs stream text but report no usage back, so these models land in the dashboard with a message count and blank columns beside it.

#### Dashboard requirements

The dashboard shells out to `packages/desktop/resources/opencode-usage`, which ships with this repository — a fresh clone works with no extra setup. It needs the `sqlite3` binary on your system. Starting from `~/.local/share/opencode/opencode.db` (override with `$OPENCODE_DB`), it attaches every `opencode*.db` sitting beside it read-only, so totals span release channels instead of just the one this build writes to.

If that bundled script is missing, the app falls back to any `opencode-usage` on your login shell's `PATH`. If neither resolves, the panel renders a muted error and nothing else breaks.

To substitute your own, print a `sqlite3 -header -column` style table with exactly these nine columns, one row per model plus a `TOTAL` row:

```
model  provider  msgs  input  output  reasoning  cache_read  cache_write  cost
```

#### Versioning

This fork versions **independently of upstream**, starting at `0.1.0`. Upstream is on the `1.18.x` line, so there is no overlap and no ambiguity about which project a given version refers to. The upstream release this fork is currently rebased on is recorded as `upstreamBase` in the root `package.json`.

Releases and the desktop auto-updater resolve against [this fork's releases](https://github.com/toshon-jennings/opencode-rig/releases) — never upstream's.

---

Everything else is upstream OpenCode. See [upstream's docs](https://opencode.ai/docs) for the underlying feature set.

![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)

---

### Installation

#### Homebrew (macOS desktop app)

```bash
brew install toshon-jennings/tap/oc-rig
```

Or tap first, then install:

```bash
brew tap toshon-jennings/tap
brew install --cask oc-rig
```

Then launch **OpenCode Rig** from your Applications folder (or Spotlight).

#### From source

Clone [this repository](https://github.com/toshon-jennings/opencode-rig) and build from source — see [CONTRIBUTING.md](./CONTRIBUTING.md).

> \[!TIP\] Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

OpenCode is also available as a desktop application. Download directly from the [releases page](https://github.com/anomalyco/opencode/releases) or [opencode.ai/download](https://opencode.ai/download).

PlatformDownloadmacOS (Apple Silicon)`opencode-desktop-mac-arm64.dmg`macOS (Intel)`opencode-desktop-mac-x64.dmg`Windows`opencode-desktop-windows-x64.exe`Linux`.deb`, `.rpm`, or `.AppImage`

```bash
# macOS (Homebrew)
brew install --cask opencode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/opencode-desktop
```

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$OPENCODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if it exists or can be created)
4. `$HOME/.opencode/bin` - Default fallback

```bash
# Examples
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### Agents

OpenCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks. This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/docs/agents).

### Documentation

For more info on how to configure OpenCode, [**head over to Docs**](https://opencode.ai/docs).

### Contributing

If you're interested in contributing to OpenCode (**not this fork**), please read [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on OpenCode

If you are working on a project that's related to OpenCode and is using "opencode" as part of its name, for example "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the OpenCode team and is not affiliated with us in any way.

---

**Join the OpenCode community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
