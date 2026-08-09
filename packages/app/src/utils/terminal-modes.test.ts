import { describe, expect, test } from "bun:test"

import {
  RESTORED_TERMINAL_MODES,
  captureTerminalModes,
  parseTerminalModes,
  terminalModeSequence,
} from "./terminal-modes"

const ESC = "\u001b"

const fakeTerm = (enabled: number[]) => ({
  getMode: (mode: number) => enabled.includes(mode),
})

describe("captureTerminalModes", () => {
  test("captures the enabled subset", () => {
    expect(captureTerminalModes(fakeTerm([1002, 1006, 2004]))).toEqual([1002, 1006, 2004])
  })

  test("an emulator with nothing on reports an empty set, not unknown", () => {
    expect(captureTerminalModes(fakeTerm([]))).toEqual([])
  })

  test("ignores modes outside the allowlist", () => {
    expect(captureTerminalModes(fakeTerm([1049, 2031, 25]))).toEqual([])
  })

  // ghostty's getMode asserts the terminal is open. A mount torn down before it rendered must
  // report "unknown" so it cannot overwrite the modes a working mount captured.
  test("returns undefined when the terminal cannot be queried", () => {
    expect(
      captureTerminalModes({
        getMode: () => {
          throw new Error("terminal is not open")
        },
      }),
    ).toBeUndefined()
    expect(captureTerminalModes({})).toBeUndefined()
    expect(captureTerminalModes(undefined)).toBeUndefined()
  })
})

describe("parseTerminalModes", () => {
  test("accepts persisted values", () => {
    expect(parseTerminalModes([1002, 1006])).toEqual([1002, 1006])
  })

  test("drops anything not on the allowlist", () => {
    expect(parseTerminalModes([1002, 9999, "1006", null])).toEqual([1002])
  })

  test("returns undefined for missing or empty state", () => {
    expect(parseTerminalModes(undefined)).toBeUndefined()
    expect(parseTerminalModes([])).toBeUndefined()
    expect(parseTerminalModes("1002")).toBeUndefined()
  })
})

describe("terminalModeSequence", () => {
  test("emits DEC private enable sequences", () => {
    expect(terminalModeSequence([1002, 1006])).toBe(`${ESC}[?1002h${ESC}[?1006h`)
  })

  test("emits nothing for an empty or missing set", () => {
    expect(terminalModeSequence([])).toBe("")
    expect(terminalModeSequence(undefined)).toBe("")
  })

  // Persisted JSON is attacker-shaped input as far as this function is concerned: values are
  // matched against the allowlist, never interpolated, so nothing arbitrary reaches the wire.
  test("never interpolates a value it was given", () => {
    const hostile: readonly number[] = ["1002; rm -rf /", `1002h${ESC}[?1049h`, 1002.5, Number.NaN] as never[]
    expect(terminalModeSequence(hostile)).toBe("")
    expect(terminalModeSequence([...hostile, 1002])).toBe(`${ESC}[?1002h`)
  })

  test("round-trips a capture", () => {
    const captured = captureTerminalModes(fakeTerm([2004, 1002]))
    expect(terminalModeSequence(parseTerminalModes(captured))).toBe(`${ESC}[?1002h${ESC}[?2004h`)
  })
})

test("every restored mode defaults to off, so re-asserting the captured set is lossless", () => {
  // Default-on modes (7 autowrap, 12 blink, 25 visible) would need their off-state recorded
  // too. Modes SerializeAddon already handles (1049 alt screen, 2031 color scheme) stay out.
  const restored: readonly number[] = RESTORED_TERMINAL_MODES
  for (const mode of [7, 12, 25, 1049, 2031]) {
    expect(restored).not.toContain(mode)
  }
})
