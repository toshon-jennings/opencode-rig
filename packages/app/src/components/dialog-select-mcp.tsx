import { Component, createMemo, createResource, createSignal, For, Match, Show, Switch as SolidSwitch } from "solid-js"
import { useSync } from "@/context/sync"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { Switch } from "@opencode-ai/ui/switch"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tag } from "@opencode-ai/ui/v2/badge-v2"
import { useLanguage } from "@/context/language"
import { useMcpToggle } from "@/context/mcp"
import { useServerSDK } from "@/context/server-sdk"
import { useLocal } from "@/context/local"
import { matchMcpTools, parseParameters, type McpToolItem } from "./dialog-select-mcp-helpers"

const statusLabels = {
  connected: "mcp.status.connected",
  failed: "mcp.status.failed",
  needs_auth: "mcp.status.needs_auth",
  needs_client_registration: "mcp.status.needs_client_registration",
  disabled: "mcp.status.disabled",
} as const

export function McpServerInspector(props: { serverName: string; status: string; tools: McpToolItem[] }) {
  const language = useLanguage()
  const matchingTools = createMemo(() => matchMcpTools(props.tools, props.serverName))

  return (
    <div
      class="mt-2 pt-2 border-t border-border-weak-base flex flex-col gap-2 w-full text-left"
      data-component="mcp-server-inspector"
    >
      <div class="text-11-medium text-text-weak flex items-center justify-between">
        <span>{language.t("dialog.mcp.inspector.tools")}</span>
        <Show when={props.status === "connected"}>
          <span class="text-11-regular text-text-weaker">{matchingTools().length}</span>
        </Show>
      </div>

      <SolidSwitch>
        <Match when={props.status !== "connected"}>
          <div class="text-11-regular text-text-weaker italic py-0.5">
            {language.t("dialog.mcp.inspector.notConnected")}
          </div>
        </Match>
        <Match when={matchingTools().length === 0}>
          <div class="text-11-regular text-text-weaker italic py-0.5">{language.t("dialog.mcp.inspector.noTools")}</div>
        </Match>
        <Match when={matchingTools().length > 0}>
          <div class="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            <For each={matchingTools()}>
              {(tool) => {
                const params = createMemo(() => parseParameters(tool.parameters))
                return (
                  <div class="p-2 rounded bg-surface-raised-base flex flex-col gap-1 text-12-regular border border-border-weak-base">
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-mono text-12-medium text-text-base truncate">{tool.id}</span>
                    </div>
                    <Show when={tool.description}>
                      <div class="text-text-weak text-11-regular">{tool.description}</div>
                    </Show>
                    <Show when={params().length > 0}>
                      <div class="mt-1 flex flex-col gap-1 pt-1 border-t border-border-weak-base/50">
                        <span class="text-11-medium text-text-weaker uppercase tracking-wider">
                          {language.t("dialog.mcp.inspector.schema")}
                        </span>
                        <div class="flex flex-col gap-1">
                          <For each={params()}>
                            {(param) => (
                              <div class="flex items-start gap-1.5 text-11-regular">
                                <code class="font-mono text-text-base text-11-medium shrink-0">{param.name}</code>
                                <Show when={param.type}>
                                  <Tag class="shrink-0 text-[10px] py-0 px-1">{param.type}</Tag>
                                </Show>
                                <Show when={param.required}>
                                  <Tag class="shrink-0 text-[10px] py-0 px-1 text-icon-warning-base">
                                    {language.t("dialog.mcp.inspector.required")}
                                  </Tag>
                                </Show>
                                <Show when={param.description}>
                                  <span class="text-text-weaker truncate flex-1">{param.description}</span>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </Match>
      </SolidSwitch>
    </div>
  )
}

export const DialogSelectMcp: Component = () => {
  const sync = useSync()
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const local = useLocal()
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})

  const items = createMemo(() =>
    Object.entries(sync().data.mcp ?? {})
      .map(([name, status]) => ({ name, status: status.status }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )

  const toggle = useMcpToggle()

  const effectiveModel = createMemo(() => {
    const current = local.model.current()
    if (current) return { provider: current.provider.id, model: current.id }
    const first = local.model.list()[0]
    if (first) return { provider: first.provider.id, model: first.id }
    return undefined
  })

  const [tools] = createResource(
    effectiveModel,
    async (params) => {
      if (!params) return []
      const res = await serverSDK()
        .client.tool.list(params)
        .catch(() => undefined)
      return (res?.data ?? []) as McpToolItem[]
    },
    { initialValue: [] as McpToolItem[] },
  )

  const enabledCount = createMemo(() => items().filter((i) => i.status === "connected").length)
  const totalCount = createMemo(() => items().length)

  const isExpanded = (name: string) => !!expanded()[name]
  const toggleExpand = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <Dialog
      title={language.t("dialog.mcp.title")}
      description={language.t("dialog.mcp.description", { enabled: enabledCount(), total: totalCount() })}
    >
      <List
        class="px-3"
        search={{ placeholder: language.t("common.search.placeholder"), autofocus: true }}
        emptyMessage={language.t("dialog.mcp.empty")}
        key={(x) => x?.name ?? ""}
        items={items}
        filterKeys={["name", "status"]}
        sortBy={(a, b) => a.name.localeCompare(b.name)}
        onSelect={(x) => {
          if (!x || x.status === "pending" || toggle.isPending) return
          toggle.mutate(x.name)
        }}
      >
        {(i) => {
          const mcpStatus = () => sync().data.mcp[i.name]
          const status = () => mcpStatus()?.status
          const statusLabel = () => {
            const key = status() ? statusLabels[status() as keyof typeof statusLabels] : undefined
            if (!key) return
            return language.t(key)
          }
          const error = () => {
            const s = mcpStatus()
            if (s?.status === "failed" || s?.status === "needs_client_registration") return s.error
          }
          const enabled = () => status() === "connected"
          return (
            <div class="w-full flex flex-col gap-1">
              <div class="w-full flex items-center justify-between gap-x-3">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <IconButton
                    icon={isExpanded(i.name) ? "chevron-down" : "chevron-right"}
                    size="small"
                    variant="ghost"
                    aria-label={
                      isExpanded(i.name)
                        ? language.t("dialog.mcp.inspector.collapse")
                        : language.t("dialog.mcp.inspector.expand")
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(i.name)
                    }}
                  />
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="truncate">{i.name}</span>
                      <Show when={statusLabel()}>
                        <span class="text-11-regular text-text-weaker">{statusLabel()}</span>
                      </Show>
                    </div>
                    <Show when={error()}>
                      <span class="text-11-regular text-text-weaker truncate">{error()}</span>
                    </Show>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={enabled()}
                    disabled={status() === "pending" || (toggle.isPending && toggle.variables === i.name)}
                    onChange={() => {
                      if (toggle.isPending) return
                      toggle.mutate(i.name)
                    }}
                  />
                </div>
              </div>
              <Show when={isExpanded(i.name)}>
                <McpServerInspector serverName={i.name} status={status() ?? "disabled"} tools={tools()} />
              </Show>
            </div>
          )
        }}
      </List>
    </Dialog>
  )
}
