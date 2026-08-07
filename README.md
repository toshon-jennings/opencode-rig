Community fork of OpenCode adding an integrated terminal and a persistent usage dashboard. Not affiliated with the OpenCode team.

---

<p align="center">
  <a href="https://github.com/toshon-jennings/opencode-rig">
    <picture>
      <source srcset="assets/logo-rig-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="assets/logo-rig-light.svg" media="(prefers-color-scheme: light)">
      <img src="assets/logo-rig-light.svg" alt="opencode-rig logo">
    </picture>
  </a>
</p>
<p align="center">opencode-rig — an unofficial fork of the open source AI coding agent.</p>
<p align="center">
  <a href="https://github.com/toshon-jennings/opencode-rig">github.com/toshon-jennings/opencode-rig</a>
</p>

> [!IMPORTANT]
> **This is an unofficial community fork.** It is not built, maintained, endorsed, or
> supported by the OpenCode team, and it is not affiliated with them in any way.
>
> Please do not file issues about this fork on the upstream tracker, and do not ask the
> OpenCode maintainers for support with it. Report problems with this fork at
> [toshon-jennings/opencode-rig/issues](https://github.com/toshon-jennings/opencode-rig/issues).
>
> For the official project, see [opencode.ai](https://opencode.ai) and
> [anomalyco/opencode](https://github.com/anomalyco/opencode).
> "OpenCode" and the OpenCode logo belong to their respective owners; the mark above is a
> modified version used only to distinguish this fork.

### What this fork adds

#### Persistent usage dashboard

A panel pinned across the bottom of the session view, reporting per model: messages,
input / output / reasoning tokens, cache reads and writes, and cost — plus a `TOTAL` row.

- **Always visible.** No toggle, keybind, or slash command — it is part of the session
  layout, like the message timeline or the prompt input.
- **Live.** Refreshes every 30 seconds and on mount, with a last-updated stamp in the
  header and a manual **Refresh** button.
- **Resizable.** Drag its top edge; the height persists across restarts.
- **Quiet on failure.** If the underlying command is missing or errors, the panel shows a
  muted message instead of breaking the session view.
- **Desktop only.** Web builds render nothing, since the panel needs local command
  execution.

#### Integrated terminal

A terminal available directly in the session view, kept alongside the usage dashboard in
the same layout so you can run commands without leaving the conversation.

#### Requirements

The dashboard shells out to [`packages/desktop/resources/opencode-usage`](packages/desktop/resources/opencode-usage),
which ships with this repository — a fresh clone works with no extra setup. It reads the
local OpenCode database at `~/.local/share/opencode/opencode.db` (override with
`$OPENCODE_DB`) and needs the `sqlite3` binary on your system.

If that bundled script is missing, the app falls back to any `opencode-usage` on your
login shell's `PATH`. If neither resolves, the panel renders a muted error and nothing
else breaks.

To substitute your own, print a `sqlite3 -header -column` style table with exactly these
eight columns, one row per model plus a `TOTAL` row:

```
model  msgs  input  output  reasoning  cache_read  cache_write  cost
```

#### Versioning

This fork versions **independently of upstream**, starting at `0.1.0`. Upstream is on the
`1.18.x` line, so there is no overlap and no ambiguity about which project a given version
refers to. The upstream release this fork is currently rebased on is recorded as
`upstreamBase` in the root `package.json`.

Releases and the desktop auto-updater resolve against
[this fork's releases](https://github.com/toshon-jennings/opencode-rig/releases) —
never upstream's.

---

Everything else is upstream OpenCode. See [upstream's docs](https://opencode.ai/docs) for
the underlying feature set.

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### Installation

#### Homebrew (macOS and Linux)

```bash
brew install toshon-jennings/tap/oc-rig
```

Or tap first, then install:

```bash
brew tap toshon-jennings/tap
brew install oc-rig
```

Then run:

```bash
cd <project>
oc-rig
```

#### From source

Clone [this repository](https://github.com/toshon-jennings/opencode-rig) and
build from source — see [CONTRIBUTING.md](./CONTRIBUTING.md).

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

OpenCode is also available as a desktop application. Download directly from the [releases page](https://github.com/anomalyco/opencode/releases) or [opencode.ai/download](https://opencode.ai/download).

| Platform              | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `opencode-desktop-mac-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, or `.AppImage`     |

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

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/docs/agents).

### Documentation

For more info on how to configure OpenCode, [**head over to Docs**](https://opencode.ai/docs).

### Contributing

If you're interested in contributing to OpenCode (**not this fork**), please read [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on OpenCode

If you are working on a project that's related to OpenCode and is using "opencode" as part of its name, for example "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the OpenCode team and is not affiliated with us in any way.

---

**Join the OpenCode community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
