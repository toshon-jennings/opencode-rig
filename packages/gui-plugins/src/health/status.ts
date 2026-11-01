export type HealthStatus = "operational" | "degraded" | "unreachable"

/** One finished request to a provider. */
export type Sample = { ok: boolean; latencyMs?: number }

export type Health = {
  status: HealthStatus
  /** The last successful response's latency. */
  latencyMs?: number
  /** What responses usually take. */
  baselineMs?: number
  /** Requests failed in a row, ending at the latest. */
  failures: number
}

const DEGRADED_LATENCY_MULTIPLIER = 2.5
const BASELINE_SMOOTHING = 0.2
const WINDOW = 5

/**
 * Folds samples, oldest first, into the provider's current health. One failure is degraded and two in a row are
 * unreachable; a response slower than 2.5 times the usual is degraded.
 *
 * The baseline lives outside the window it judges. Deriving it from that window would self-erase a sustained
 * slowdown: the first slow sample raises the mean until every later equally-slow sample falls back under the
 * threshold, so the worse the outage, the faster it would read as operational. Only samples that were not
 * themselves degraded move the baseline.
 */
export function providerHealth(samples: readonly Sample[]): Health | undefined {
  const state = samples.reduce<{ window: Sample[]; baselineMs?: number; status?: HealthStatus }>(
    (state, sample) => {
      const window = [...state.window, sample].slice(-WINDOW)
      const status = deriveStatus(window, state.baselineMs)
      const baselined = sample.ok && sample.latencyMs !== undefined && status !== "degraded"
      return {
        window,
        status,
        baselineMs: baselined ? nextBaseline(state.baselineMs, sample.latencyMs!) : state.baselineMs,
      }
    },
    { window: [] },
  )
  if (!state.status) return
  return {
    status: state.status,
    latencyMs: state.window.findLast((sample) => sample.ok)?.latencyMs,
    baselineMs: state.baselineMs,
    failures: state.window.length - (state.window.findLastIndex((sample) => sample.ok) + 1),
  }
}

export function nextBaseline(current: number | undefined, latencyMs: number) {
  if (current === undefined) return latencyMs
  return current * (1 - BASELINE_SMOOTHING) + latencyMs * BASELINE_SMOOTHING
}

function deriveStatus(window: readonly Sample[], baselineMs?: number): HealthStatus | undefined {
  const last = window.at(-1)
  if (!last) return
  if (!last.ok) return window.at(-2)?.ok === false ? "unreachable" : "degraded"
  if (baselineMs !== undefined && last.latencyMs !== undefined && last.latencyMs > baselineMs * DEGRADED_LATENCY_MULTIPLIER)
    return "degraded"
  return "operational"
}
