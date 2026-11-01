import { ComposerPill, type ComposerPillProps, type Plugin } from "@opencode/plugin/gui"
import { catalogModel } from "../context/catalog"
import type HealthDefinition from "./index"
import { providerHealth, type Sample } from "./status"

const HISTORY = 30

/**
 * A pill above the composer when the provider behind the session's latest answer is struggling, from how that
 * session's recent requests to it went. A healthy provider shows nothing. Health is judged per session, from the
 * messages it already holds, so there is no probe and nothing to keep in sync.
 */
const setup: Plugin.Setup<typeof HealthDefinition> = (ctx) => {
  const latest = (input: ComposerPillProps) => {
    if (!input.session.id) return
    const assistants = input.session.server.data.session.message
      .list(input.session.id)
      .filter((message) => message.type === "assistant")
    const model = assistants.at(-1)?.model
    if (!model) return

    const samples = assistants
      .filter((message) => message.model.providerID === model.providerID && (message.time.completed || message.error))
      .slice(-HISTORY)
      .map((message): Sample => {
        if (message.error) return { ok: false }
        return { ok: true, latencyMs: (message.time.streamed ?? message.time.completed!) - message.time.created }
      })
    const health = providerHealth(samples)
    if (!health || health.status === "operational") return

    return {
      health,
      provider: catalogModel(input.session, model)?.provider.name ?? model.providerID,
    }
  }

  const duration = (ms: number) => {
    const seconds = ms >= 1000
    return new Intl.NumberFormat(ctx.locale.locale(), {
      style: "unit",
      unit: seconds ? "second" : "millisecond",
      unitDisplay: "narrow",
      maximumFractionDigits: seconds ? 1 : 0,
    }).format(seconds ? ms / 1000 : ms)
  }

  ctx.add(ComposerPill, {
    id: "main",
    show: (input) => {
      const current = latest(input)
      if (!current) return
      const unreachable = current.health.status === "unreachable"

      return {
        label: ctx.t(unreachable ? "pill.unreachable" : "pill.degraded", { provider: current.provider }),
        icon: "circle-exclamation",
        tone: unreachable ? "danger" : "warning",
        rows: [
          ...(current.health.failures > 0
            ? [{ id: "failed", label: ctx.t("row.failed"), detail: String(current.health.failures) }]
            : []),
          ...(current.health.latencyMs !== undefined && current.health.failures === 0
            ? [{ id: "last", label: ctx.t("row.last"), detail: duration(current.health.latencyMs) }]
            : []),
          ...(current.health.baselineMs !== undefined
            ? [{ id: "usual", label: ctx.t("row.usual"), detail: duration(current.health.baselineMs) }]
            : []),
        ],
      }
    },
  })
}

export default setup
