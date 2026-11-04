import { lazy, Suspense } from "solid-js"
import { Command, Slot, type Plugin } from "@opencode/plugin/gui"
import type Usage from "./index"

/** The usage report: a strip across the bottom of the window, because seeing what models cost is what Rig is for. */
const setup: Plugin.Setup<typeof Usage> = (ctx) => {
  // Main reads the databases, so the web client has nothing to show.
  if (!ctx.desktop) return

  const UsageStrip = lazy(() => import("./panel"))
  // The strip shows at startup, so it must not wait for its chunk in the first render.
  void UsageStrip.preload()

  ctx.add(Slot, {
    at: "window.bottom",
    render: () => (
      <Suspense>
        <UsageStrip />
      </Suspense>
    ),
  })

  ctx.add(Command, {
    id: "toggle",
    get title() {
      return ctx.t("command.toggle")
    },
    get group() {
      return ctx.t("command.category.view")
    },
    keywords: "usage tokens cost models spend",
    get enabled() {
      return !ctx.layout.narrow()
    },
    run: () => ctx.stores.strip.update((strip) => void (strip.open = !strip.open)),
  })
}

export default setup
