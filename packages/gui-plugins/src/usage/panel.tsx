import { createMemo, For, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { usePlugin } from "@opencode/plugin/gui"
import { UsageReport, type UsageRow } from "./contract"
import type Usage from "./index"

const REFRESH_MS = 30_000

type ColumnKey = Exclude<keyof UsageRow, never>
type SortDirection = "asc" | "desc"

/**
 * Columns are tinted by family (prompt-side, generated, cost), so neighbouring groups differ and a row can be scanned
 * without reading the headers. Tones are theme tokens, so they follow the active theme. The `-active` ramp step is
 * deliberate: `-base` is tuned for icons and drops to about 1.5:1 on light backgrounds, unreadable at this size.
 */
const COLUMNS = [
  { key: "model", tone: "text-text-strong", numeric: false },
  { key: "provider", tone: "text-text-weak", numeric: false },
  { key: "msgs", tone: "text-text-weak", numeric: true },
  { key: "input", tone: "text-icon-info-active", numeric: true },
  { key: "output", tone: "text-icon-success-active", numeric: true },
  { key: "reasoning", tone: "text-icon-success-active", numeric: true },
  { key: "cacheRead", tone: "text-icon-info-active", numeric: true },
  { key: "cacheWrite", tone: "text-icon-info-active", numeric: true },
  { key: "cost", tone: "text-icon-warning-active", numeric: true },
] as const

const NUMERIC = ["msgs", "input", "output", "reasoning", "cacheRead", "cacheWrite", "cost"] as const

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

function formatCost(value: number) {
  if (value === 0) return "$0"
  return `$${value.toFixed(value < 1 ? 4 : 2)}`
}

function cell(row: UsageRow, key: ColumnKey) {
  if (key === "model" || key === "provider") return row[key]
  return key === "cost" ? formatCost(row.cost) : formatCount(row[key])
}

/** A column full of zeroes is noise, so empty metrics drop out of their family tint. */
function tone(row: UsageRow, column: (typeof COLUMNS)[number]) {
  const value = cell(row, column.key)
  return value === "0" || value === "$0" ? "text-text-weak" : column.tone
}

function compare(a: UsageRow, b: UsageRow, key: ColumnKey, direction: SortDirection) {
  const sign = direction === "asc" ? 1 : -1
  if (key === "model" || key === "provider") return sign * a[key].localeCompare(b[key])
  return sign * (a[key] - b[key])
}

function sum(rows: readonly UsageRow[]) {
  return Object.fromEntries(NUMERIC.map((key) => [key, rows.reduce((total, row) => total + row[key], 0)])) as Pick<
    UsageRow,
    (typeof NUMERIC)[number]
  >
}

export default function UsageTab() {
  const ctx = usePlugin<typeof Usage>()
  const report = ctx.use(UsageReport)
  const [state, setState] = createStore<{
    rows: readonly UsageRow[] | undefined
    error: string | undefined
    loading: boolean
    updatedAt: string | undefined
    sort: { key: ColumnKey; direction: SortDirection } | undefined
    filter: string
  }>({ rows: undefined, error: undefined, loading: true, updatedAt: undefined, sort: undefined, filter: "" })

  const refresh = async () => {
    const live = report()

    if (live.status !== "active") return setState({ error: ctx.t("failed"), loading: false })

    await live.value.read({ signal: ctx.signal }).then(
      (result) => setState({ rows: result.rows, error: undefined, updatedAt: new Date().toLocaleTimeString() }),
      (error: Error) => setState({ error: error.message || ctx.t("failed") }),
    )
    setState("loading", false)
  }

  onMount(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    onCleanup(() => clearInterval(timer))
  })

  const query = () => state.filter.toLowerCase().trim()

  const filtered = createMemo(() => {
    const rows = state.rows ?? []

    if (!query()) return rows

    return rows.filter((row) => row.model.toLowerCase().includes(query()) || row.provider.toLowerCase().includes(query()))
  })

  const sorted = createMemo(() => {
    const sort = state.sort

    return sort ? [...filtered()].sort((a, b) => compare(a, b, sort.key, sort.direction)) : filtered()
  })

  // The total follows the filter: a filtered view sums only what it shows.
  const total = createMemo(() => {
    if (filtered().length === 0) return undefined

    return {
      ...sum(filtered()),
      model: query() ? ctx.t("total.filtered", { count: filtered().length }) : ctx.t("total"),
      provider: "-",
    } satisfies UsageRow
  })

  // Numbers sort high to low first, names A to Z; a third click clears the sort.
  const sortBy = (key: ColumnKey) => {
    const numeric = key !== "model" && key !== "provider"
    const first: SortDirection = numeric ? "desc" : "asc"
    const sort = state.sort

    if (sort?.key !== key) return setState("sort", { key, direction: first })

    setState("sort", sort.direction === first ? { key, direction: first === "desc" ? "asc" : "desc" } : undefined)
  }

  const indicator = (key: ColumnKey) => (state.sort?.key !== key ? "" : state.sort.direction === "asc" ? " ↑" : " ↓")

  return (
    <div class="flex flex-col h-full bg-v2-background-bg-base">
      <div class="flex items-center gap-2 px-4 py-2 border-b border-border-weaker-base shrink-0">
        <span class="text-14-medium text-text-strong">{ctx.t("title")}</span>
        <Show when={query() && state.rows}>
          {(rows) => (
            <span class="text-12-regular text-text-weak">
              {ctx.t("filter.showing", { shown: filtered().length, total: rows().length })}
            </span>
          )}
        </Show>
        <div class="flex-1" />
        <div class="relative flex items-center">
          <input
            type="text"
            placeholder={ctx.t("filter.placeholder")}
            value={state.filter}
            onInput={(event) => setState("filter", event.currentTarget.value)}
            class="text-12-regular text-text-base bg-transparent border border-border-weaker-base rounded px-2 py-1 w-40 placeholder:text-text-weak focus:outline-none focus:border-border-base"
          />
          <Show when={state.filter}>
            <button
              type="button"
              onClick={() => setState("filter", "")}
              class="absolute right-1 text-12-regular text-text-weak hover:text-text-base px-1"
              aria-label={ctx.t("filter.clear")}
            >
              ✕
            </button>
          </Show>
        </div>
        <span class="text-12-regular text-text-weak">{state.updatedAt}</span>
        <button
          type="button"
          onClick={() => void refresh()}
          class="text-12-regular text-text-weak hover:text-text-base px-2 py-1 rounded"
        >
          {ctx.t("refresh")}
        </button>
      </div>

      <div class="flex-1 min-h-0 overflow-auto">
        <Show when={state.error}>
          {(message) => <div class="px-4 py-3 text-12-regular text-text-weak">{message()}</div>}
        </Show>

        <Show when={!state.error && state.loading}>
          <div class="px-4 py-3 text-12-regular text-text-weak">{ctx.t("loading")}</div>
        </Show>

        <Show when={!state.error && state.rows}>
          <Show
            when={sorted().length > 0}
            fallback={
              <div class="px-4 py-8 text-center text-12-regular text-text-weak">
                <div>{ctx.t("filter.empty", { query: state.filter })}</div>
                <button
                  type="button"
                  onClick={() => setState("filter", "")}
                  class="mt-2 text-12-regular text-text-base hover:underline"
                >
                  {ctx.t("filter.clear")}
                </button>
              </div>
            }
          >
            <table class="w-full text-12-regular">
              <thead class="sticky top-0 z-10 bg-v2-background-bg-base">
                <tr>
                  <For each={COLUMNS}>
                    {(column, index) => (
                      <th
                        class="px-3 py-2 font-bold text-text-weak border-b border-border-weaker-base cursor-pointer select-none hover:text-text-base"
                        classList={{ "text-left": index() === 0, "text-right": index() > 0 }}
                        onClick={() => sortBy(column.key)}
                      >
                        {ctx.t(`column.${column.key}`)}
                        <span class="text-text-weak">{indicator(column.key)}</span>
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={sorted()}>
                  {(row) => (
                    <tr class="hover:bg-surface-base">
                      <For each={COLUMNS}>
                        {(column, index) => (
                          <td
                            class={`px-3 py-1.5 whitespace-nowrap ${tone(row, column)}`}
                            classList={{ "text-right font-mono": index() > 0 }}
                          >
                            {cell(row, column.key)}
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
              <tfoot class="sticky bottom-0 z-10 bg-v2-background-bg-base">
                <Show when={total()}>
                  {(row) => (
                    <tr class="border-t border-border-base">
                      <For each={COLUMNS}>
                        {(column, index) => (
                          <td
                            class={`px-3 py-1.5 font-medium whitespace-nowrap ${tone(row(), column)}`}
                            classList={{ "text-right font-mono": index() > 0 }}
                          >
                            {cell(row(), column.key)}
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </Show>
              </tfoot>
            </table>
          </Show>
        </Show>
      </div>
    </div>
  )
}
