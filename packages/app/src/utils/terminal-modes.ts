import { getModeIfSupported } from "./runtime-adapters"

/**
 * DEC private modes carried across a terminal remount.
 *
 * `SerializeAddon` only captures screen contents (plus `?2031` and `?1049`), so a terminal
 * rebuilt from its serialized buffer comes up with a clean mode state. ghostty gates every
 * mouse handler on a live `hasMouseTracking()` query, so a full-screen TUI that enabled
 * mouse tracking once at startup silently stops receiving clicks after a remount — it still
 * believes reporting is on, so it never re-emits the enable sequence. Keyboard input keeps
 * working because key handling never consults these modes.
 *
 * Every mode here defaults to OFF, so capturing the enabled set and re-asserting it is
 * lossless. Default-ON modes (7 autowrap, 12 cursor blink, 25 cursor visible) are excluded
 * because restoring those would also require recording their off-state.
 */
export const RESTORED_TERMINAL_MODES = [
  1, // DECCKM — application cursor keys
  1000, // mouse: click tracking
  1002, // mouse: button-event tracking (drag)
  1003, // mouse: any-event tracking (motion)
  1004, // focus in/out reporting
  1005, // mouse encoding: UTF-8
  1006, // mouse encoding: SGR
  1015, // mouse encoding: URXVT
  1016, // mouse encoding: SGR pixel
  2004, // bracketed paste
] as const

/**
 * Returns the enabled subset, or undefined when the terminal cannot be queried. An empty
 * array means "all off" and is meaningful: a TUI that exited turned its modes back off, and
 * re-asserting stale mouse tracking into a plain shell would feed it escape-sequence garbage
 * on every click. Undefined means "unknown", so a mount that died early cannot wipe what a
 * working one captured.
 */
export function captureTerminalModes(term: unknown) {
  const modes: number[] = []
  for (const mode of RESTORED_TERMINAL_MODES) {
    const enabled = getModeIfSupported(term, mode)
    if (enabled === undefined) return undefined
    if (enabled) modes.push(mode)
  }
  return modes
}

export function parseTerminalModes(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const modes = RESTORED_TERMINAL_MODES.filter((mode) => value.includes(mode))
  return modes.length ? modes.slice() : undefined
}

/**
 * Builds the enable sequence for a persisted mode set. Values are matched against the
 * allowlist rather than interpolated, so nothing from persisted JSON reaches the escape
 * sequence verbatim.
 */
export function terminalModeSequence(modes: readonly number[] | undefined) {
  if (!modes?.length) return ""
  return RESTORED_TERMINAL_MODES.filter((mode) => modes.includes(mode))
    .map((mode) => `\u001b[?${mode}h`)
    .join("")
}
