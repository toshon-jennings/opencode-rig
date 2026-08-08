export type ProviderHealthStatus = "operational" | "degraded" | "unreachable"

export type ProviderHealthState = {
  status: ProviderHealthStatus
  latencyMs?: number
  updatedAt: number
  source: "telemetry" | "probe"
}

export type ProviderHealthSample = {
  at: number
  ok: boolean
  latencyMs?: number
  source: ProviderHealthState["source"]
}

const DEGRADED_LATENCY_MULTIPLIER = 2.5
const BASELINE_SMOOTHING = 0.2

// The baseline deliberately lives outside the rolling sample window it judges. Deriving it
// from that window self-erases a sustained slowdown: the first slow sample raises the mean
// until every later equally-slow sample falls back under the threshold, so the worse the
// outage the faster the status returns to "operational". This EWMA instead absorbs only
// samples that were not themselves flagged degraded.
export function nextProviderBaseline(current: number | undefined, latencyMs: number) {
  if (current === undefined) return latencyMs
  return current * (1 - BASELINE_SMOOTHING) + latencyMs * BASELINE_SMOOTHING
}

// Probe failures share one metadata endpoint, so they can only establish degraded
// health. Unreachable requires failure evidence from real provider traffic.
export function deriveProviderStatus(
  samples: ProviderHealthSample[],
  baselineMs?: number,
): ProviderHealthStatus | undefined {
  if (samples.length === 0) return undefined
  const last = samples[samples.length - 1]
  if (!last.ok) {
    const prev = samples[samples.length - 2]
    return prev && !prev.ok && (last.source === "telemetry" || prev.source === "telemetry") ? "unreachable" : "degraded"
  }
  if (
    baselineMs !== undefined &&
    last.latencyMs !== undefined &&
    last.latencyMs > baselineMs * DEGRADED_LATENCY_MULTIPLIER
  )
    return "degraded"
  return "operational"
}

export function providerHealthDotClass(status: ProviderHealthStatus | undefined) {
  if (status === "operational") return "bg-icon-success-base"
  if (status === "degraded") return "bg-icon-warning-base"
  if (status === "unreachable") return "bg-icon-critical-base"
  return "bg-border-weak-base"
}

export function formatProviderLatency(ms: number) {
  const rounded = Math.round(ms)
  if (rounded < 1000) return `${rounded}ms`
  return `${(rounded / 1000).toFixed(1)}s`
}
