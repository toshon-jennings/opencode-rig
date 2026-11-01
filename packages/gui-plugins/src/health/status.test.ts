import { describe, expect, test } from "bun:test"
import { nextBaseline, providerHealth, type Sample } from "./status"

const ok = (latencyMs: number): Sample => ({ ok: true, latencyMs })
const fail: Sample = { ok: false }

describe("providerHealth", () => {
  test("has nothing to say without samples", () => {
    expect(providerHealth([])).toBeUndefined()
  })

  test("is operational after healthy responses", () => {
    expect(providerHealth([ok(500), ok(520)])?.status).toBe("operational")
  })

  test("is degraded after one failure", () => {
    expect(providerHealth([ok(500), fail])).toMatchObject({ status: "degraded", failures: 1, latencyMs: 500 })
  })

  test("is unreachable after two failures in a row", () => {
    expect(providerHealth([ok(500), fail, fail])).toMatchObject({ status: "unreachable", failures: 2 })
  })

  test("recovers once a failure is followed by a success", () => {
    expect(providerHealth([fail, fail, ok(500)])).toMatchObject({ status: "operational", failures: 0 })
  })

  test("is degraded when latency spikes far above the usual", () => {
    expect(providerHealth([ok(500), ok(500), ok(3000)])).toMatchObject({ status: "degraded", latencyMs: 3000 })
  })

  test("stays operational for latency close to the usual", () => {
    expect(providerHealth([ok(500), ok(500), ok(600)])?.status).toBe("operational")
  })

  test("does not judge latency before a baseline exists", () => {
    expect(providerHealth([ok(5000)])?.status).toBe("operational")
  })

  // A baseline taken from the judged window absorbed the slow samples, so a sustained slowdown reported one blip
  // and then read as operational for the rest of the outage.
  test("stays degraded through a sustained slowdown", () => {
    const health = providerHealth([ok(500), ok(500), ok(500), ok(3000), ok(3000), ok(3000), ok(3000), ok(3000)])
    expect(health?.status).toBe("degraded")
    expect(health?.baselineMs).toBe(500)
  })

  test("the baseline converges on a genuine shift", () => {
    const baseline = Array.from({ length: 20 }).reduce<number>((current) => nextBaseline(current, 900), 500)
    expect(baseline).toBeGreaterThan(890)
    expect(baseline).toBeLessThanOrEqual(900)
  })
})
