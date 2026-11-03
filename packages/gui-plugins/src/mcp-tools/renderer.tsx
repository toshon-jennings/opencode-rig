import { lazy, onCleanup, Suspense } from "solid-js"
import { Command, type Plugin } from "@opencode/plugin/gui"
import { onIdle } from "@opencode/plugin/gui/builtin"
import type McpTools from "./index"

/** The MCP tool inspector: each connected server's tools with their parameters, from the palette or the details flyout. */
const setup: Plugin.Setup<typeof McpTools> = (ctx) => {
  const ToolsDialog = lazy(() => import("./dialog"))
  onCleanup(onIdle(() => void ToolsDialog.preload()))

  ctx.add(Command, {
    id: "open",
    get title() {
      return ctx.t("command.open")
    },
    get group() {
      return ctx.t("command.category")
    },
    keywords: "mcp tools schema parameters inspector",
    get enabled() {
      return ctx.sessions.current() !== undefined
    },
    run: () => {
      const session = ctx.sessions.current()

      if (session)
        ctx.dialogs.open(() => (
          <Suspense>
            <ToolsDialog session={session} />
          </Suspense>
        ))
    },
  })
}

export default setup
