import type { Message } from "@opencode-ai/sdk/v2/client"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { createEffect, createRoot, getOwner, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { ServerSDK } from "./server-sdk"
import { ServerConnection } from "./server"
import { useGlobal } from "./global"
import { deriveProviderStatus, type ProviderHealthState, type ProviderHealthSample } from "./provider-health"

const MAX_SAMPLES = 5
const MAX_TRACKED_MESSAGES = 500

function createServerProviderHealthState(input: { sdk: ServerSDK }) {
  const [store, setStore] = createStore<Record<string, ProviderHealthState>>({})
  const samples = new Map<string, ProviderHealthSample[]>()
  const seenMessages = new Set<string>()
  const seenOrder: string[] = []

  const rememberMessage = (id: string) => {
    seenMessages.add(id)
    seenOrder.push(id)
    if (seenOrder.length <= MAX_TRACKED_MESSAGES) return
    const evicted = seenOrder.shift()
    if (evicted) seenMessages.delete(evicted)
  }

  const record = (providerID: string, sample: ProviderHealthSample) => {
    const list = samples.get(providerID) ?? []
    list.push(sample)
    if (list.length > MAX_SAMPLES) list.shift()
    samples.set(providerID, list)
    const status = deriveProviderStatus(list)
    if (!status) return
    setStore(providerID, {
      status,
      latencyMs: sample.latencyMs ?? store[providerID]?.latencyMs,
      updatedAt: sample.at,
      source: sample.source,
    })
  }

  const unsub = input.sdk.event.listen((e) => {
    const event = e.details
    if (event.type !== "message.updated") return
    const info = (event.properties as { info: Message }).info
    if (info.role !== "assistant" || !info.time.completed || seenMessages.has(info.id)) return
    rememberMessage(info.id)
    record(info.providerID, {
      at: info.time.completed,
      ok: !info.error,
      latencyMs: info.time.completed - info.time.created,
      source: "telemetry",
    })
  })
  onCleanup(unsub)

  return {
    status(providerID: string) {
      return store[providerID] as ProviderHealthState | undefined
    },
  }
}

type ProviderHealthServerState = ReturnType<typeof createServerProviderHealthState>

export const { use: useProviderHealth, provider: ProviderHealthProvider } = createSimpleContext({
  name: "ProviderHealth",
  init: () => {
    const global = useGlobal()
    const owner = getOwner()
    const states = new Map<ServerConnection.Key, { dispose: () => void; state: ProviderHealthServerState }>()

    const ensure = (key: ServerConnection.Key) => {
      const existing = states.get(key)
      if (existing) return existing.state
      const conn = global.servers.list().find((item) => ServerConnection.key(item) === key)
      if (!conn) return undefined
      const ctx = global.ensureServerCtx(conn)
      const root = createRoot(
        (dispose) => ({ dispose, state: createServerProviderHealthState({ sdk: ctx.sdk }) }),
        owner ?? undefined,
      )
      states.set(key, root)
      return root.state
    }

    createEffect(() => {
      global.servers.list().forEach((conn) => ensure(ServerConnection.key(conn)))
    })

    createEffect(() => {
      const keys = new Set(global.servers.list().map((conn) => ServerConnection.key(conn)))
      states.forEach((value, key) => {
        if (keys.has(key)) return
        value.dispose()
        states.delete(key)
      })
    })

    onCleanup(() => states.forEach((value) => value.dispose()))

    return {
      status(key: ServerConnection.Key, providerID: string) {
        return ensure(key)?.status(providerID)
      },
    }
  },
})
