import { lazy, onCleanup, Suspense } from "solid-js"
import { SettingsPage, type Plugin } from "@opencode/plugin/gui"
import { onIdle } from "@opencode/plugin/gui/builtin"
import type definition from "./index"

/** A settings page below About for what OpenCode Rig changes; it never edits upstream's About page. */
const setup: Plugin.Setup<typeof definition> = (ctx) => {
  const Page = lazy(() => import("./page"))
  onCleanup(onIdle(() => void Page.preload()))

  ctx.add(SettingsPage, {
    id: "rig",
    icon: "branch-out",
    group: "about",
    get title() {
      return ctx.t("title")
    },
    get entries() {
      return [{ id: "rig", title: ctx.t("title"), keywords: "rig fork differences version upstream" }]
    },
    render: () => (
      <Suspense>
        <Page />
      </Suspense>
    ),
  })
}

export default setup
