import { createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { usePlatform } from "@/context/platform"

const REFRESH_MS = 30_000

type UsageRow = {
  model: string
  msgs: string
  input: string
  output: string
  reasoning: string
  cacheRead: string
  cacheWrite: string
  cost: string
}

type UsageData = {
  rows: UsageRow[]
  total?: UsageRow
}

/**
 * Columns are tinted by family — prompt-side, generated, cost — so neighbouring groups
 * differ and a row can be scanned without reading the headers. Tones are theme tokens,
 * so they follow whichever theme is active rather than being fixed colors. The `-active`
 * ramp step is deliberate: `-base` is tuned for icons and drops to ~1.5:1 on light
 * backgrounds, which is unreadable at this text size.
 */
const COLUMNS = [
  { key: "model", label: "Model", tone: "text-text-strong" },
  { key: "msgs", label: "Msgs", tone: "text-text-weak" },
  { key: "input", label: "Input", tone: "text-icon-info-active" },
  { key: "output", label: "Output", tone: "text-icon-success-active" },
  { key: "reasoning", label: "Reasoning", tone: "text-icon-success-active" },
  { key: "cacheRead", label: "Cache Read", tone: "text-icon-info-active" },
  { key: "cacheWrite", label: "Cache Write", tone: "text-icon-info-active" },
  { key: "cost", label: "Cost", tone: "text-icon-warning-active" },
] as const

/**
 * Parses `sqlite3 -header -column` output: a header row, a row of dashes, then
 * one fixed-width row per model. Columns are separated by two or more spaces.
 */
function parseUsage(stdout: string): UsageData {
  const rows: UsageRow[] = []
  let total: UsageRow | undefined

  for (const line of stdout.split("\n")) {
    const parts = line.trim().split(/\s{2,}/)
    if (parts.length !== COLUMNS.length) continue
    if (parts[0] === "model") continue
    if (parts.every((part) => /^-+$/.test(part))) continue

    const row: UsageRow = {
      model: parts[0],
      msgs: parts[1],
      input: parts[2],
      output: parts[3],
      reasoning: parts[4],
      cacheRead: parts[5],
      cacheWrite: parts[6],
      cost: parts[7],
    }

    if (row.model === "TOTAL") total = row
    else rows.push(row)
  }

  return { rows, total }
}

function formatCount(value: string) {
  const num = Number(value.replace(/,/g, ""))
  if (!Number.isFinite(num)) return value
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString()
}

function formatCost(value: string) {
  const num = Number(value)
  if (!Number.isFinite(num)) return value
  if (num === 0) return "$0"
  return `$${num.toFixed(num < 1 ? 4 : 2)}`
}

function cell(row: UsageRow, key: (typeof COLUMNS)[number]["key"]) {
  if (key === "model") return row.model
  if (key === "cost") return formatCost(row.cost)
  return formatCount(row[key])
}

/** A column full of zeroes is noise, so empty metrics drop out of their family tint. */
function tone(row: UsageRow, col: (typeof COLUMNS)[number]) {
  const value = cell(row, col.key)
  return value === "0" || value === "$0" ? "text-text-weak" : col.tone
}

export function UsagePanel() {
  const platform = usePlatform()
  // The platform omits Usage when the host cannot provide a local report.
  if (!platform.getUsage) return null
  const run = () => platform.getUsage!()

  const [data, setData] = createSignal<UsageData>()
  const [error, setError] = createSignal<string>()
  const [loading, setLoading] = createSignal(true)
  const [updatedAt, setUpdatedAt] = createSignal<string>()

  const refresh = async () => {
    try {
      const result = await run()
      if (result.code !== 0) {
        setError(result.stderr.trim() || `opencode-usage exited with code ${result.code}`)
        return
      }
      setData(parseUsage(result.stdout))
      setUpdatedAt(new Date().toLocaleTimeString())
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <div class="flex flex-col h-full bg-v2-background-bg-base">
      <div class="flex items-center gap-2 px-4 py-2 border-b border-border-weaker-base shrink-0">
        <span class="text-14-medium text-text-strong">Usage</span>
        <span class="text-12-regular text-text-weak flex-1">{updatedAt()}</span>
        <button
          type="button"
          onClick={() => void refresh()}
          class="text-12-regular text-text-weak hover:text-text-base px-2 py-1 rounded"
        >
          Refresh
        </button>
      </div>

      <div class="flex-1 min-h-0 overflow-auto">
        <Show when={error()}>
          {(message) => <div class="px-4 py-3 text-12-regular text-text-weak">{message()}</div>}
        </Show>

        <Show when={!error() && loading()}>
          <div class="px-4 py-3 text-12-regular text-text-weak">Loading…</div>
        </Show>

        <Show when={!error() && data()}>
          {(usage) => (
            <table class="w-full text-12-regular">
              <thead class="sticky top-0 z-10 bg-v2-background-bg-base">
                <tr>
                  <For each={COLUMNS}>
                    {(col, index) => (
                      <th
                        class="px-3 py-2 font-medium text-text-weak border-b border-border-weaker-base"
                        classList={{ "text-left": index() === 0, "text-right": index() > 0 }}
                      >
                        {col.label}
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={usage().rows}>
                  {(row) => (
                    <tr class="hover:bg-surface-base">
                      <For each={COLUMNS}>
                        {(col, index) => (
                          <td
                            class={`px-3 py-1.5 whitespace-nowrap ${tone(row, col)}`}
                            classList={{ "text-right font-mono": index() > 0 }}
                          >
                            {cell(row, col.key)}
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
              <Show when={usage().total}>
                {(total) => (
                  <tfoot class="sticky bottom-0 z-10 bg-v2-background-bg-base">
                    <tr class="border-t border-border-base">
                      <For each={COLUMNS}>
                        {(col, index) => (
                          <td
                            class={`px-3 py-1.5 font-medium whitespace-nowrap ${tone(total(), col)}`}
                            classList={{ "text-right font-mono": index() > 0 }}
                          >
                            {cell(total(), col.key)}
                          </td>
                        )}
                      </For>
                    </tr>
                  </tfoot>
                )}
              </Show>
            </table>
          )}
        </Show>
      </div>
    </div>
  )
}
