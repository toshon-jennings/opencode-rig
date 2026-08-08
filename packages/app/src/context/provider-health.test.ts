import { describe, expect, test } from "bun:test"
import {
  deriveProviderStatus,
  nextProviderBaseline,
  formatProviderLatency,
  providerHealthDotClass,
  type ProviderHealthSample,
} from "./provider-health"

describe("deriveProviderStatus", () => {
  test("returns undefined with no samples", () => {
    expect(deriveProviderStatus([])).toBeUndefined()
  })

  test("is operational after a single healthy sample", () => {
    expect(deriveProviderStatus([{ at: 1, ok: true, latencyMs: 500, source: "telemetry" }])).toBe("operational")
  })

  test("is degraded after a single failure", () => {
    expect(
      deriveProviderStatus([
        { at: 1, ok: true, latencyMs: 500, source: "telemetry" },
        { at: 2, ok: false, source: "telemetry" },
      ]),
    ).toBe("degraded")
  })

  test("is unreachable after two consecutive failures with telemetry evidence", () => {
    expect(
      deriveProviderStatus([
        { at: 1, ok: false, source: "telemetry" },
        { at: 2, ok: false, source: "probe" },
      ]),
    ).toBe("unreachable")
  })

  test("caps repeated probe failures at degraded", () => {
    expect(
      deriveProviderStatus([
        { at: 1, ok: false, source: "probe" },
        { at: 2, ok: false, source: "probe" },
      ]),
    ).toBe("degraded")
  })

  test("recovers to operational after a failure is followed by a success", () => {
    const samples = [
      { at: 1, ok: false, source: "telemetry" },
      { at: 2, ok: true, latencyMs: 500, source: "telemetry" },
    ] satisfies ProviderHealthSample[]
    expect(deriveProviderStatus(samples)).toBe("operational")
  })

  test("is degraded when latency spikes far above the baseline", () => {
    const samples = [{ at: 1, ok: true, latencyMs: 3000, source: "telemetry" }] satisfies ProviderHealthSample[]
    expect(deriveProviderStatus(samples, 510)).toBe("degraded")
  })

  test("stays operational for latency close to the baseline", () => {
    const samples = [{ at: 1, ok: true, latencyMs: 600, source: "telemetry" }] satisfies ProviderHealthSample[]
    expect(deriveProviderStatus(samples, 510)).toBe("operational")
  })

  test("does not judge latency before a baseline exists", () => {
    const samples = [{ at: 1, ok: true, latencyMs: 5000, source: "telemetry" }] satisfies ProviderHealthSample[]
    expect(deriveProviderStatus(samples)).toBe("operational")
  })

  // Regression: a window-derived baseline absorbed the slow samples it was judging, so a
  // sustained slowdown reported one "degraded" blip and then returned to "operational"
  // for the rest of the outage.
  test("stays degraded through a sustained slowdown", () => {
    let baseline: number | undefined
    for (const latencyMs of [500, 500, 500, 500]) baseline = nextProviderBaseline(baseline, latencyMs)
    for (const at of [5, 6, 7, 8, 9]) {
      const samples = [{ at, ok: true, latencyMs: 3000, source: "telemetry" }] satisfies ProviderHealthSample[]
      const status = deriveProviderStatus(samples, baseline)
      expect(status).toBe("degraded")
      if (status !== "degraded") baseline = nextProviderBaseline(baseline, 3000)
    }
  })

  test("baseline converges on a genuine shift once samples are no longer degraded", () => {
    let baseline = nextProviderBaseline(undefined, 500)
    for (let i = 0; i < 20; i++) baseline = nextProviderBaseline(baseline, 900)
    expect(baseline).toBeGreaterThan(890)
    expect(baseline).toBeLessThanOrEqual(900)
  })
})

describe("providerHealthDotClass", () => {
  test("maps each status to a distinct color", () => {
    expect(providerHealthDotClass("operational")).toBe("bg-icon-success-base")
    expect(providerHealthDotClass("degraded")).toBe("bg-icon-warning-base")
    expect(providerHealthDotClass("unreachable")).toBe("bg-icon-critical-base")
    expect(providerHealthDotClass(undefined)).toBe("bg-border-weak-base")
  })
})

describe("formatProviderLatency", () => {
  // Regression: the branch tested the unrounded value but printed the rounded one, so
  // anything in [999.5, 1000) rendered as "1000ms" instead of "1.0s".
  test("promotes a value that rounds up to a full second", () => {
    expect(formatProviderLatency(999.6)).toBe("1.0s")
  })

  test("formats sub-second latency in milliseconds", () => {
    expect(formatProviderLatency(420)).toBe("420ms")
  })

  test("formats second-plus latency in seconds", () => {
    expect(formatProviderLatency(2350)).toBe("2.4s")
  })
})
