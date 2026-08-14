import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { usePlatform } from "@/context/platform"

const REFRESH_MS = 30_000

type UsageRow = {
  model: string
  provider: string
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

type ColumnKey = (typeof COLUMNS)[number]["key"]
type SortDirection = "asc" | "desc" | null

/**
 * Columns are tinted by family — prompt-side, generated, cost — so neighbouring groups
 * differ and a row can be scanned without reading the headers. Tones are theme tokens,
 * so they follow whichever theme is active rather than being fixed colors. The `-active`
 * ramp step is deliberate: `-base` is tuned for icons and drops to ~1.5:1 on light
 * backgrounds, which is unreadable at this text size.
 */
const COLUMNS = [
  { key: "model", label: "Model", tone: "text-text-strong", numeric: false },
  { key: "provider", label: "Provider", tone: "text-text-weak", numeric: false },
  { key: "msgs", label: "Msgs", tone: "text-text-weak", numeric: true },
  { key: "input", label: "Input", tone: "text-icon-info-active", numeric: true },
  { key: "output", label: "Output", tone: "text-icon-success-active", numeric: true },
  { key: "reasoning", label: "Reasoning", tone: "text-icon-success-active", numeric: true },
  { key: "cacheRead", label: "Cache Read", tone: "text-icon-info-active", numeric: true },
  { key: "cacheWrite", label: "Cache Write", tone: "text-icon-info-active", numeric: true },
  { key: "cost", label: "Cost", tone: "text-icon-warning-active", numeric: true },
] as const

const NUMERIC_KEYS = new Set<string>(COLUMNS.filter((c) => c.numeric).map((c) => c.key))

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
      provider: parts[1],
      msgs: parts[2],
      input: parts[3],
      output: parts[4],
      reasoning: parts[5],
      cacheRead: parts[6],
      cacheWrite: parts[7],
      cost: parts[8],
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

function cell(row: UsageRow, key: ColumnKey) {
  if (key === "model") return row.model
  if (key === "provider") return row.provider
  if (key === "cost") return formatCost(row.cost)
  return formatCount(row[key])
}

/** A column full of zeroes is noise, so empty metrics drop out of their family tint. */
function tone(row: UsageRow, col: (typeof COLUMNS)[number]) {
  const value = cell(row, col.key)
  return value === "0" || value === "$0" ? "text-text-weak" : col.tone
}

/** Parse a raw string value into a comparable number. */
function rawNumeric(row: UsageRow, key: ColumnKey): number {
  const raw = row[key]
  const num = Number(raw.replace(/,/g, ""))
  return Number.isFinite(num) ? num : 0
}

/** Compare two rows for sorting. */
function compareRows(a: UsageRow, b: UsageRow, key: ColumnKey, dir: "asc" | "desc"): number {
  const mul = dir === "asc" ? 1 : -1
  if (NUMERIC_KEYS.has(key)) return mul * (rawNumeric(a, key) - rawNumeric(b, key))
  return mul * a[key].localeCompare(b[key])
}

/** Compute a synthetic total row from a list of rows. */
function computeTotal(rows: UsageRow[]): UsageRow {
  let msgs = 0
  let input = 0
  let output = 0
  let reasoning = 0
  let cacheRead = 0
  let cacheWrite = 0
  let cost = 0
  for (const r of rows) {
    msgs += rawNumeric(r, "msgs")
    input += rawNumeric(r, "input")
    output += rawNumeric(r, "output")
    reasoning += rawNumeric(r, "reasoning")
    cacheRead += rawNumeric(r, "cacheRead")
    cacheWrite += rawNumeric(r, "cacheWrite")
    cost += rawNumeric(r, "cost")
  }
  return {
    model: `TOTAL (${rows.length})`,
    provider: "-",
    msgs: String(msgs),
    input: String(input),
    output: String(output),
    reasoning: String(reasoning),
    cacheRead: String(cacheRead),
    cacheWrite: String(cacheWrite),
    cost: String(cost),
  }
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
  const [sortColumn, setSortColumn] = createSignal<ColumnKey | null>(null)
  const [sortDirection, setSortDirection] = createSignal<SortDirection>(null)
  const [filter, setFilter] = createSignal("")

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

  const filteredRows = createMemo(() => {
    const d = data()
    if (!d) return []
    const query = filter().toLowerCase().trim()
    if (!query) return d.rows
    return d.rows.filter(
      (row) => row.model.toLowerCase().includes(query) || row.provider.toLowerCase().includes(query),
    )
  })

  const sortedRows = createMemo(() => {
    const rows = filteredRows()
    const col = sortColumn()
    const dir = sortDirection()
    if (!col || !dir) return rows
    return [...rows].sort((a, b) => compareRows(a, b, col, dir))
  })

  const displayTotal = createMemo(() => {
    const d = data()
    if (!d) return undefined
    const query = filter().toLowerCase().trim()
    if (!query) return d.total
    const rows = filteredRows()
    if (rows.length === 0) return undefined
    return computeTotal(rows)
  })

  function handleSort(key: ColumnKey) {
    const isNumeric = NUMERIC_KEYS.has(key)
    if (sortColumn() !== key) {
      setSortColumn(key)
      setSortDirection(isNumeric ? "desc" : "asc")
      return
    }
    const dir = sortDirection()
    if (isNumeric) {
      if (dir === "desc") setSortDirection("asc")
      else {
        setSortColumn(null)
        setSortDirection(null)
      }
      return
    }
    if (dir === "asc") setSortDirection("desc")
    else {
      setSortColumn(null)
      setSortDirection(null)
    }
  }

  function sortIndicator(key: ColumnKey) {
    if (sortColumn() !== key) return ""
    return sortDirection() === "asc" ? " ↑" : " ↓"
  }

  return (
    <div class="flex flex-col h-full bg-v2-background-bg-base">
      <div class="flex items-center gap-2 px-4 py-2 border-b border-border-weaker-base shrink-0">
        <span class="text-14-medium text-text-strong">Usage</span>
        <Show when={filter().trim() && data()}>
          <span class="text-12-regular text-text-weak">
            Showing {filteredRows().length} of {data()!.rows.length}
          </span>
        </Show>
        <div class="flex-1" />
        <div class="relative flex items-center">
          <input
            type="text"
            placeholder="Filter models…"
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
            class="text-12-regular text-text-base bg-transparent border border-border-weaker-base rounded px-2 py-1 w-40 placeholder:text-text-weak focus:outline-none focus:border-border-base"
          />
          <Show when={filter()}>
            <button
              type="button"
              onClick={() => setFilter("")}
              class="absolute right-1 text-12-regular text-text-weak hover:text-text-base px-1"
              aria-label="Clear filter"
            >
              ✕
            </button>
          </Show>
        </div>
        <span class="text-12-regular text-text-weak">{updatedAt()}</span>
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
          {(_usage) => (
            <Show
              when={sortedRows().length > 0}
              fallback={
                <div class="px-4 py-8 text-center text-12-regular text-text-weak">
                  <div>No models match '{filter()}'</div>
                  <button
                    type="button"
                    onClick={() => setFilter("")}
                    class="mt-2 text-12-regular text-text-base hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
              }
            >
              <table class="w-full text-12-regular">
                <thead class="sticky top-0 z-10 bg-v2-background-bg-base">
                  <tr>
                    <For each={COLUMNS}>
                      {(col, index) => (
                        <th
                          class="px-3 py-2 font-bold text-text-weak border-b border-border-weaker-base cursor-pointer select-none hover:text-text-base"
                          classList={{ "text-left": index() === 0, "text-right": index() > 0 }}
                          onClick={() => handleSort(col.key)}
                        >
                          {col.label}
                          <span class="text-text-weak">{sortIndicator(col.key)}</span>
                        </th>
                      )}
                    </For>
                  </tr>
                </thead>
                <tbody>
                  <For each={sortedRows()}>
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
                <tfoot class="sticky bottom-0 z-10 bg-v2-background-bg-base">
                  <Show when={displayTotal()}>
                    {(total) => (
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
                    )}
                  </Show>
                </tfoot>
              </table>
            </Show>
          )}
        </Show>
      </div>
    </div>
  )
}
