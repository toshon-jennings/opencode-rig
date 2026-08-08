import { describe, expect, test } from "bun:test"
import {
  deriveProviderStatus,
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

  test("is degraded when latency spikes far above the recent baseline", () => {
    const samples = [
      { at: 1, ok: true, latencyMs: 500, source: "telemetry" },
      { at: 2, ok: true, latencyMs: 520, source: "telemetry" },
      { at: 3, ok: true, latencyMs: 3000, source: "telemetry" },
    ] satisfies ProviderHealthSample[]
    expect(deriveProviderStatus(samples)).toBe("degraded")
  })

  test("stays operational for latency close to the recent baseline", () => {
    const samples = [
      { at: 1, ok: true, latencyMs: 500, source: "telemetry" },
      { at: 2, ok: true, latencyMs: 520, source: "telemetry" },
      { at: 3, ok: true, latencyMs: 600, source: "telemetry" },
    ] satisfies ProviderHealthSample[]
    expect(deriveProviderStatus(samples)).toBe("operational")
  })

  test("does not judge latency against a single prior sample", () => {
    const samples = [
      { at: 1, ok: true, latencyMs: 100, source: "telemetry" },
      { at: 2, ok: true, latencyMs: 5000, source: "telemetry" },
    ] satisfies ProviderHealthSample[]
    expect(deriveProviderStatus(samples)).toBe("operational")
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
  test("formats sub-second latency in milliseconds", () => {
    expect(formatProviderLatency(420)).toBe("420ms")
  })

  test("formats second-plus latency in seconds", () => {
    expect(formatProviderLatency(2350)).toBe("2.4s")
  })
})
