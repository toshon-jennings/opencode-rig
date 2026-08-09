// Lives in test-browser, not src: the --conditions=solid unit suite loads Solid's SERVER
// build, where signals do not propagate and every reactivity assertion silently passes as
// "no change". This needs --conditions=browser.
import { createRoot, createSignal } from "solid-js"
import { expect, test } from "bun:test"

import { createTerminalMountTracker } from "../src/pages/session/terminal-mount"

const setup = () =>
  createRoot((dispose) => {
    const [opened, setOpened] = createSignal(false)
    const [active, setActive] = createSignal<string | undefined>(undefined)
    const mount = createTerminalMountTracker({ opened, active })
    return { mount, setOpened, setActive, dispose }
  })

// v0.2.1 mounted every restored terminal on app start, including while the panel was still
// collapsed to height:0. ghostty-web's proposeDimensions() bails at zero size, so those
// terminals came up without character metrics and were dead — while terminals created after
// opening the panel worked. Nothing may mount before the panel has been open.
test("nothing mounts while the panel is closed", () => {
  const { mount, setActive, dispose } = setup()
  setActive("t1")
  expect(mount.has("t1")).toBe(false)
  dispose()
})

test("the active terminal mounts once the panel opens", () => {
  const { mount, setOpened, setActive, dispose } = setup()
  setActive("t1")
  setOpened(true)
  expect(mount.has("t1")).toBe(true)
  dispose()
})

// The v0.2.1 change existed to stop unmounting on tab switch, which loses emulator state
// such as mouse tracking. Deferring the first mount must not reintroduce that.
test("terminals stay mounted after switching away", () => {
  const { mount, setOpened, setActive, dispose } = setup()
  setOpened(true)
  setActive("t1")
  setActive("t2")
  expect(mount.has("t1")).toBe(true)
  expect(mount.has("t2")).toBe(true)
  dispose()
})

test("terminals never activated stay unmounted", () => {
  const { mount, setOpened, setActive, dispose } = setup()
  setOpened(true)
  setActive("t1")
  expect(mount.has("t1")).toBe(true)
  expect(mount.has("restored-but-never-opened")).toBe(false)
  dispose()
})

test("closing the panel does not unmount what is already mounted", () => {
  const { mount, setOpened, setActive, dispose } = setup()
  setOpened(true)
  setActive("t1")
  setOpened(false)
  expect(mount.has("t1")).toBe(true)
  dispose()
})
