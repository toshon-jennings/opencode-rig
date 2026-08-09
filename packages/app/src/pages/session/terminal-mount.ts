import { createComputed, createSignal, type Accessor } from "solid-js"

/**
 * Tracks which terminals may be rendered.
 *
 * The terminal panel collapses to `height: 0px` when closed, so anything mounted inside it
 * initialises against a zero-size box. ghostty-web's `proposeDimensions()` bails when
 * `clientWidth`/`clientHeight` is 0, so the renderer comes up without usable character
 * metrics and the terminal is dead on arrival.
 *
 * v0.2.1's "keep terminal mounted when switching tabs" change swapped a
 * `<Show when={opened() && terminal.active()}>` for a `<For each={all()}>`, which mounted
 * EVERY restored terminal on app start — including while the panel was still closed. That
 * is why terminals carried over from a previous session were broken while newly created
 * ones (made with the panel already open) worked.
 *
 * Mounting is therefore deferred until a terminal has been active at least once while the
 * panel was open. After that it stays mounted, which is what the original change was for:
 * unmounting on tab switch loses emulator state such as mouse tracking.
 */
export function createTerminalMountTracker(input: { opened: Accessor<boolean>; active: Accessor<string | undefined> }) {
  const [mounted, setMounted] = createSignal<ReadonlySet<string>>(new Set())

  // createComputed, not createEffect: the terminal must appear in the same reactive pass
  // that opens the panel, otherwise the first paint after opening renders an empty body.
  createComputed(() => {
    if (!input.opened()) return
    const id = input.active()
    if (!id) return
    setMounted((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      return next
    })
  })

  return {
    /** True once this terminal has been activated with the panel open. */
    has: (id: string) => mounted().has(id),
  }
}
