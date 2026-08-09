import { beforeAll, describe, expect, mock, test } from "bun:test"
import { ServerScope } from "@/utils/server-scope"

let getWorkspaceTerminalCacheKey: typeof import("./terminal").getWorkspaceTerminalCacheKey
let getLegacyTerminalStorageKeys: (dir: string, legacySessionID?: string) => string[]
let migrateTerminalState: (value: unknown) => unknown
let trimTerminal: typeof import("./terminal").trimTerminal

beforeAll(async () => {
  mock.module("@solidjs/router", () => ({
    useNavigate: () => () => undefined,
    useParams: () => ({}),
    useLocation: () => ({}),
    useSearchParams: () => [{}, () => undefined],
  }))
  mock.module("@opencode-ai/ui/context", () => ({
    createSimpleContext: () => ({
      use: () => undefined,
      provider: () => undefined,
    }),
  }))
  const mod = await import("./terminal")
  getWorkspaceTerminalCacheKey = mod.getWorkspaceTerminalCacheKey
  getLegacyTerminalStorageKeys = mod.getLegacyTerminalStorageKeys
  migrateTerminalState = mod.migrateTerminalState
  trimTerminal = mod.trimTerminal
})

describe("getWorkspaceTerminalCacheKey", () => {
  test("uses workspace-only directory cache key", () => {
    expect(String(getWorkspaceTerminalCacheKey("/repo"))).toBe("local\u0000/repo\u0000__workspace__")
  })

  test("can include a server scope", () => {
    expect(String(getWorkspaceTerminalCacheKey("/repo", "ssh:debian" as ServerScope))).toBe(
      "ssh:debian\u0000/repo\u0000__workspace__",
    )
  })
})

describe("getLegacyTerminalStorageKeys", () => {
  test("keeps workspace storage path when no legacy session id", () => {
    expect(getLegacyTerminalStorageKeys("/repo")).toEqual(["/repo/terminal.v1"])
  })

  test("includes legacy session path before workspace path", () => {
    expect(getLegacyTerminalStorageKeys("/repo", "session-123")).toEqual([
      "/repo/terminal/session-123.v1",
      "/repo/terminal.v1",
    ])
  })
})

// Switching to a session in another directory trims every terminal in the one being left,
// so the reconnect replays from cursor 0. The server's ring buffer evicts from the front at
// 2 MB, so for a busy TUI the mouse-tracking enable sequence is no longer in that replay --
// the captured modes are the only way mouse input comes back.
describe("trimTerminal", () => {
  test("drops replayable state but keeps emulator modes", () => {
    expect(
      trimTerminal({
        id: "one",
        title: "vim",
        titleNumber: 1,
        rows: 24,
        cols: 80,
        buffer: "screen contents",
        cursor: 4096,
        scrollY: 12,
        modes: [1002, 1006],
      }),
    ).toEqual({
      id: "one",
      title: "vim",
      titleNumber: 1,
      rows: 24,
      cols: 80,
      buffer: undefined,
      cursor: undefined,
      scrollY: undefined,
      modes: [1002, 1006],
    })
  })

  test("leaves an already-trimmed terminal untouched", () => {
    const pty = { id: "one", title: "vim", titleNumber: 1, modes: [1002] }
    expect(trimTerminal(pty)).toBe(pty)
  })
})

describe("migrateTerminalState", () => {
  test("drops invalid terminals and restores a valid active terminal", () => {
    expect(
      migrateTerminalState({
        active: "missing",
        all: [
          null,
          { id: "one", title: "Terminal 2" },
          { id: "one", title: "duplicate", titleNumber: 9 },
          { id: "two", title: "logs", titleNumber: 4, rows: 24, cols: 80 },
          { title: "no-id" },
        ],
      }),
    ).toEqual({
      active: "one",
      all: [
        { id: "one", title: "Terminal 2", titleNumber: 2 },
        { id: "two", title: "logs", titleNumber: 4, rows: 24, cols: 80 },
      ],
    })
  })

  // Emulator modes are not in the serialized buffer, so they persist as their own field. A
  // terminal saved before this field existed simply comes back without it.
  test("restores persisted emulator modes and drops values off the allowlist", () => {
    expect(
      migrateTerminalState({
        active: "one",
        all: [
          { id: "one", title: "vim", titleNumber: 1, modes: [1002, 1006, 9999] },
          { id: "two", title: "shell", titleNumber: 2 },
          { id: "three", title: "old", titleNumber: 3, modes: "1002" },
        ],
      }),
    ).toEqual({
      active: "one",
      all: [
        { id: "one", title: "vim", titleNumber: 1, modes: [1002, 1006] },
        { id: "two", title: "shell", titleNumber: 2 },
        { id: "three", title: "old", titleNumber: 3 },
      ],
    })
  })

  test("keeps a valid active id", () => {
    expect(
      migrateTerminalState({
        active: "two",
        all: [
          { id: "one", title: "Terminal 1" },
          { id: "two", title: "shell", titleNumber: 7 },
        ],
      }),
    ).toEqual({
      active: "two",
      all: [
        { id: "one", title: "Terminal 1", titleNumber: 1 },
        { id: "two", title: "shell", titleNumber: 7 },
      ],
    })
  })
})
