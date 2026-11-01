import { Schema } from "effect"
import { Ipc } from "@opencode/plugin/gui"

/** Token and cost totals for one model of one provider, over every assistant message on this machine. */
export const UsageRow = Schema.Struct({
  model: Schema.String,
  provider: Schema.String,
  msgs: Schema.Number,
  input: Schema.Number,
  output: Schema.Number,
  reasoning: Schema.Number,
  cacheRead: Schema.Number,
  cacheWrite: Schema.Number,
  cost: Schema.Number,
})

export type UsageRow = typeof UsageRow.Type

/** The local usage report, read from the OpenCode databases next to this install. Main only reads them. */
export const UsageReport = Ipc.define({
  id: "usage.report",
  methods: {
    /** Totals per model and provider, most input first. Fails when no database holds messages. */
    read: { output: Schema.Struct({ rows: Schema.Array(UsageRow) }) },
  },
})
