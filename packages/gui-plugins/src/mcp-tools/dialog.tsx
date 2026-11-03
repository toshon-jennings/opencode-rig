import { createMemo, createResource, createSignal, For, Index, Match, onMount, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import type { McpServer, McpTool } from "@opencode/client/promise"
import { Markdown } from "@opencode/session-ui/markdown"
import { Dialog, DialogBody, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { Icon } from "@opencode/ui/icon"
import { TextInput } from "@opencode/ui/text-input"
import { usePlugin, type MountedSession } from "@opencode/plugin/gui"
import { parameters, type Parameter } from "./parameters"
import type McpTools from "./index"

// Ported from the fork's expandable rows in the MCP dialog. Each tool reads as its call signature, optional
// parameters marked `?` as in TypeScript, instead of type and "Required" pills.
export default function McpToolsDialog(props: { session: MountedSession }) {
  const ctx = usePlugin<typeof McpTools>()
  const directory = props.session.directory
  const data = () => props.session.server.data
  const [store, setStore] = createStore<{ query: string; open: Record<string, boolean> }>({ query: "", open: {} })

  onMount(
    () =>
      void data()
        .location.mcp.server.sync({ directory })
        .catch(() => undefined),
  )

  const servers = createMemo(() =>
    (data().location.mcp.server.list({ directory }) ?? []).toSorted((a, b) => a.name.localeCompare(b.name)),
  )

  // Connecting, disconnecting or signing in changes a server's tools, so a status change lists them again.
  const [tools, { refetch }] = createResource(
    () =>
      servers()
        .map((server) => `${server.name}\0${server.status.status}`)
        .join("\n"),
    () =>
      props.session.server.client.experimental.mcp.tool.list({ location: { directory } }).then((result) => result.data),
  )

  // `.latest` suspends until the first value, so read it only once there is one.
  const loaded = () => tools.state === "ready" || tools.state === "refreshing"

  const connected = createMemo(() => {
    if (!loaded()) return []
    const names = new Set(servers().flatMap((server) => (server.status.status === "connected" ? [server.name] : [])))

    return (tools.latest ?? []).filter((tool) => names.has(tool.server))
  })

  const query = () => store.query.trim().toLowerCase()

  let list: HTMLDivElement | undefined

  // New results start at the top, not wherever the last ones were scrolled to.
  const search = (value: string) => {
    setStore("query", value)
    list?.scrollTo({ top: 0 })
  }

  // While searching, a server named by the query keeps all its tools; others keep only the tools that match.
  const sections = createMemo(() =>
    servers().flatMap((server) => {
      const list = connected().filter((tool) => tool.server === server.name)

      if (!query() || server.name.toLowerCase().includes(query())) return [{ server, tools: list }]

      const hits = list.filter((tool) =>
        [tool.name, tool.title, tool.description].some((text) => text?.toLowerCase().includes(query())),
      )

      return hits.length ? [{ server, tools: hits }] : []
    }),
  )

  return (
    <Dialog size="large" fit>
      <DialogHeader>
        <DialogTitleGroup
          title={ctx.t("title")}
          description={loaded() ? ctx.plural("summary", connected().length) : undefined}
        />
      </DialogHeader>
      <DialogBody class="flex flex-col gap-2 min-h-0 px-4 pb-4">
        <Show when={servers().length}>
          <TextInput
            autofocus
            appearance="base"
            leadingIcon={<Icon name="magnifying-glass" size="small" />}
            placeholder={ctx.t("search.placeholder")}
            value={store.query}
            class="w-full"
            onInput={(event) => search(event.currentTarget.value)}
            showClearButton={!!store.query}
            onClearClick={() => search("")}
          />
        </Show>
        <div ref={list} class="flex-1 min-h-0 overflow-y-auto">
          <Switch>
            <Match when={!servers().length}>
              <Note>{ctx.t("empty")}</Note>
            </Match>
            <Match when={tools.error}>
              <div class="py-6 flex flex-col items-center gap-2">
                <Note>{ctx.t("loadFailed")}</Note>
                <button type="button" class="text-12-medium text-text-strong underline" onClick={() => refetch()}>
                  {ctx.t("retry")}
                </button>
              </div>
            </Match>
            <Match when={!sections().length}>
              <Note>{ctx.t("search.empty", { query: store.query.trim() })}</Note>
            </Match>
            <Match when={true}>
              <For each={sections()}>
                {(section) => (
                  <ServerSection
                    server={section.server}
                    tools={section.tools}
                    loaded={loaded()}
                    open={!!query() || !!store.open[section.server.name]}
                    onToggle={() => setStore("open", section.server.name, (open) => !open)}
                  />
                )}
              </For>
            </Match>
          </Switch>
        </div>
      </DialogBody>
    </Dialog>
  )
}

function ServerSection(props: {
  server: McpServer
  tools: McpTool[]
  loaded: boolean
  open: boolean
  onToggle: () => void
}) {
  const ctx = usePlugin<typeof McpTools>()
  const connected = () => props.server.status.status === "connected"

  // A connected server reports its tool count; any other state is the one worth words.
  const aside = () => {
    const status = props.server.status.status

    if (status !== "connected") return ctx.t(`status.${status}`)

    return props.loaded ? ctx.plural("tools", props.tools.length) : undefined
  }

  return (
    <section class="border-b border-border-weaker-base last:border-b-0">
      <button
        type="button"
        class="w-full flex items-center gap-2 px-1 py-2.5 text-left rounded-sm disabled:cursor-default enabled:hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
        disabled={!connected()}
        aria-expanded={connected() ? props.open : undefined}
        onClick={() => props.onToggle()}
      >
        <Icon
          name={props.open && connected() ? "chevron-down" : "chevron-right"}
          size="small"
          class="shrink-0 text-v2-icon-icon-muted"
          classList={{ invisible: !connected() }}
        />
        <span dir="auto" class="min-w-0 flex-1 truncate text-13-medium text-text-strong">
          {props.server.title ?? props.server.name}
        </span>
        <Show when={aside()}>
          <span class="shrink-0 text-12-regular text-text-weak">{aside()}</span>
        </Show>
      </button>
      <Show when={props.open && connected() && props.loaded}>
        <Show
          when={props.tools.length}
          fallback={<p class="pl-7 pb-3 text-12-regular text-text-weak">{ctx.t("noTools")}</p>}
        >
          <ul class="pl-7 pr-1 pb-4 flex flex-col gap-4">
            <For each={props.tools}>{(tool) => <ToolEntry tool={tool} />}</For>
          </ul>
        </Show>
      </Show>
    </section>
  )
}

function ToolEntry(props: { tool: McpTool }) {
  const ctx = usePlugin<typeof McpTools>()
  const [full, setFull] = createSignal(false)
  const params = createMemo(() => parameters(props.tool.inputSchema))
  const described = createMemo(() => params().filter((param) => param.description))
  const description = () => props.tool.description?.trim() ?? ""
  // Descriptions written for the model run to pages; the first paragraph says what the tool does.
  const lead = () => description().split(/\n\s*\n/)[0]
  // A long signature shows only its required parameters until the tool is expanded.
  const compact = () => !full() && params().length > 4
  const shown = createMemo(() => (compact() ? params().filter((param) => param.required) : params()))

  const more = () =>
    lead() !== description() || described().length > 0 || params().length > 4 || description().length > 240

  return (
    <li class="flex flex-col gap-1 min-w-0">
      <code class="font-mono text-12-regular text-text-weak [overflow-wrap:anywhere]">
        <span class="text-12-medium text-text-strong">{props.tool.name}</span>(
        <Index each={shown()}>
          {(param, index) => (
            <>
              <Show when={index > 0}>, </Show>
              <Signature param={param()} />
            </>
          )}
        </Index>
        <Show when={compact()}>{shown().length ? ", …" : "…"}</Show>)
      </code>
      <Show when={description()}>
        <Markdown
          text={full() ? description() : lead()}
          class="text-12-regular text-text-weak"
          classList={{ "line-clamp-3": !full() }}
        />
      </Show>
      <Show when={full() && described().length}>
        <dl class="mt-1 grid grid-cols-[minmax(0,max-content)_1fr] gap-x-3 gap-y-1 text-12-regular">
          <For each={described()}>
            {(param) => (
              <>
                <dt class="font-mono text-text-base truncate">{param.name}</dt>
                <dd class="text-text-weak [overflow-wrap:anywhere]">{param.description}</dd>
              </>
            )}
          </For>
        </dl>
      </Show>
      <Show when={more()}>
        <button
          type="button"
          class="self-start rounded-sm text-12-medium text-text-base hover:text-text-strong focus-visible:outline-none focus-visible:text-text-strong focus-visible:underline"
          aria-expanded={full()}
          onClick={() => setFull((value) => !value)}
        >
          {ctx.t(full() ? "less" : "more")}
        </button>
      </Show>
    </li>
  )
}

function Signature(props: { param: Parameter }) {
  return (
    <span class="whitespace-nowrap">
      <span class="text-text-base">{props.param.name}</span>
      {props.param.required ? "" : "?"}
      <Show when={props.param.type}>: {props.param.type}</Show>
    </span>
  )
}

function Note(props: { children: string }) {
  return <p class="py-6 text-center text-12-regular text-text-weak">{props.children}</p>
}
