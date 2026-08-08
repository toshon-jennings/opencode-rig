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

// Probe failures share one metadata endpoint, so they can only establish degraded
// health. Unreachable requires failure evidence from real provider traffic.
export function deriveProviderStatus(samples: ProviderHealthSample[]): ProviderHealthStatus | undefined {
  if (samples.length === 0) return undefined
  const last = samples[samples.length - 1]
  if (!last.ok) {
    const prev = samples[samples.length - 2]
    return prev && !prev.ok && (last.source === "telemetry" || prev.source === "telemetry") ? "unreachable" : "degraded"
  }
  const priorLatencies = samples
    .slice(0, -1)
    .filter(
      (sample): sample is ProviderHealthSample & { latencyMs: number } => sample.ok && sample.latencyMs !== undefined,
    )
    .map((sample) => sample.latencyMs)
  if (priorLatencies.length >= 2 && last.latencyMs !== undefined) {
    const baseline = priorLatencies.reduce((sum, value) => sum + value, 0) / priorLatencies.length
    if (last.latencyMs > baseline * DEGRADED_LATENCY_MULTIPLIER) return "degraded"
  }
  return "operational"
}

export function providerHealthDotClass(status: ProviderHealthStatus | undefined) {
  if (status === "operational") return "bg-icon-success-base"
  if (status === "degraded") return "bg-icon-warning-base"
  if (status === "unreachable") return "bg-icon-critical-base"
  return "bg-border-weak-base"
}

export function formatProviderLatency(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
