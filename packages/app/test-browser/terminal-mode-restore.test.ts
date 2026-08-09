// Lives in test-browser, not src: this drives the real ghostty-web WASM emulator, which
// needs a DOM and the browser export condition.
import { afterEach, expect, test } from "bun:test"

import { SerializeAddon } from "../src/addons/serialize"
import { captureTerminalModes, parseTerminalModes, terminalModeSequence } from "../src/utils/terminal-modes"

type Term = import("ghostty-web").Terminal

const loaded = await (async () => {
  const mod = await import("ghostty-web")
  return { mod, ghostty: await mod.Ghostty.load() }
})()

const open = () => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const term = new loaded.mod.Terminal({ cols: 80, rows: 24, ghostty: loaded.ghostty })
  const serializer = new SerializeAddon()
  term.loadAddon(serializer)
  term.open(container)
  live.push({ term, container })
  return { term, serializer }
}

const live: { term: Term; container: HTMLElement }[] = []

afterEach(() => {
  for (const { term, container } of live.splice(0)) {
    term.dispose()
    container.remove()
  }
})

const write = (term: Term, data: string) => new Promise<void>((resolve) => term.write(data, () => resolve()))

// What a full-screen TUI emits once at startup and never again: it tracks the modes itself
// and believes they are still set, so nothing re-enables them after a remount.
const TUI_STARTUP = "\u001b[?1002h\u001b[?1006h\u001b[?2004h\u001b[?1h"

test("the serialized buffer alone loses mouse tracking across a remount", async () => {
  const source = open()
  await write(source.term, TUI_STARTUP + "some output")
  expect(source.term.hasMouseTracking()).toBe(true)

  const buffer = source.serializer.serialize()
  expect(buffer).not.toContain("?1002h")

  const restored = open()
  await write(restored.term, buffer)
  // This is the reported bug: keyboard still works, clicks are silently dropped because
  // ghostty gates every mouse handler on a live hasMouseTracking() query.
  expect(restored.term.hasMouseTracking()).toBe(false)
})

test("replaying the captured modes brings mouse tracking back", async () => {
  const source = open()
  await write(source.term, TUI_STARTUP + "some output")

  const buffer = source.serializer.serialize()
  const modes = captureTerminalModes(source.term)
  expect(modes).toContain(1002)
  expect(modes).toContain(1006)

  const restored = open()
  await write(restored.term, terminalModeSequence(modes))
  await write(restored.term, buffer)

  expect(restored.term.hasMouseTracking()).toBe(true)
  expect(restored.term.hasBracketedPaste()).toBe(true)
  expect(restored.term.getMode(1006)).toBe(true)
  expect(restored.term.getMode(1)).toBe(true)
})

// Switching to a session in the same directory keeps the serialized buffer; the modes ride
// alongside it.
test("survives a same-directory switch, where the buffer is kept", async () => {
  const source = open()
  await write(source.term, TUI_STARTUP)

  const persisted = JSON.parse(
    JSON.stringify({ buffer: source.serializer.serialize(), modes: captureTerminalModes(source.term) }),
  )

  const restored = open()
  await write(restored.term, terminalModeSequence(parseTerminalModes(persisted.modes)))
  await write(restored.term, persisted.buffer)
  expect(restored.term.hasMouseTracking()).toBe(true)
})

// Switching to a session in another directory trims the buffer, so the terminal reconnects
// and replays from the server's ring buffer -- which evicts from the front at 2 MB, so a
// busy TUI's startup sequence is long gone. Only the modes survive.
test("survives a cross-directory switch, where the buffer is trimmed away", async () => {
  const source = open()
  await write(source.term, TUI_STARTUP)

  const trimmed = { buffer: undefined, cursor: undefined, scrollY: undefined, modes: captureTerminalModes(source.term) }

  const restored = open()
  await write(restored.term, terminalModeSequence(parseTerminalModes(trimmed.modes)))
  // Mid-stream replay: the enable sequence was evicted, only later output remains.
  await write(restored.term, "later output from the ring buffer")
  expect(restored.term.hasMouseTracking()).toBe(true)
})

// A TUI that exited turned its modes back off. Re-asserting them would feed the plain shell
// escape-sequence garbage on every click.
test("a terminal with nothing enabled restores nothing", async () => {
  const source = open()
  await write(source.term, TUI_STARTUP)
  await write(source.term, "\u001b[?1002l\u001b[?1006l\u001b[?2004l\u001b[?1l")

  const modes = captureTerminalModes(source.term)
  expect(modes).toEqual([])

  // Empty, so the mount writes nothing at all -- ghostty rejects a zero-length write, which
  // is why the caller guards on the sequence being non-empty rather than always writing it.
  const sequence = terminalModeSequence(modes)
  expect(sequence).toBe("")

  const restored = open()
  if (sequence) await write(restored.term, sequence)
  expect(restored.term.hasMouseTracking()).toBe(false)
})
