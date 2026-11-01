import os from "node:os"
import path from "node:path"
import type { Plugin } from "@opencode/plugin/gui/main"
import { UsageReport } from "./contract"
import { readUsage } from "./query"

const setup: Plugin.MainSetup = (ctx) => {
  // The CLI keeps its databases under the XDG data folder, `OPENCODE_DB` naming one when it is set.
  const database =
    process.env.OPENCODE_DB ??
    path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "opencode", "opencode.db")

  ctx.provide(UsageReport, {
    read: () =>
      readUsage(database).then(
        (rows) => ({ rows }),
        (error: Error) => {
          ctx.log.write("warn", "usage report failed", { error: error.message })
          throw error
        },
      ),
  })
}

export default setup
