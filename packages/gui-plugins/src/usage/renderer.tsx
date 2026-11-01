import { lazy, onCleanup } from "solid-js"
import { Command, Panel, type Plugin } from "@opencode/plugin/gui"
import { onIdle } from "@opencode/plugin/gui/builtin"
import type Usage from "./index"

/** The usage report: a side tab with token and cost totals per model, opened from the command palette. */
const setup: Plugin.Setup<typeof Usage> = (ctx) => {
  const UsageTab = lazy(() => import("./panel"))
  onCleanup(onIdle(() => void UsageTab.preload()))

  // One tab object, so strip updates and session switches do not rebuild its trigger.
  const tab = {
    id: "main",
    get title() {
      return ctx.t("title")
    },
  }

  ctx.add(Panel, {
    id: "main",
    region: "side",
    list: (input) => (input.open.includes("main") ? [tab] : []),
    render: () => <UsageTab />,
  })

  ctx.add(Command, {
    id: "open",
    get title() {
      return ctx.t("command.open")
    },
    get group() {
      return ctx.t("command.category.view")
    },
    keywords: "usage tokens cost models spend",
    get enabled() {
      return ctx.sessions.current() !== undefined
    },
    run: () => {
      const session = ctx.sessions.current()

      if (session) ctx.layout.open(`${ctx.id}:main`, session, { tab: "select" })
    },
  })
}

export default setup
