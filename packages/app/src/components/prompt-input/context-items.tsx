import { Component, For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { getDirectory, getFilename, getFilenameTruncated } from "@opencode-ai/core/util/path"
import type { ContextItem } from "@/context/prompt"
import { estimateContextTokens } from "@/context/prompt-state"

type PromptContextItem = ContextItem & { key: string }
type ContextItemTranslationKey =
  | "prompt.context.pin"
  | "prompt.context.unpin"
  | "prompt.context.removeFile"
  | "prompt.context.tokens"

type ContextItemsProps = {
  items: PromptContextItem[]
  active: (item: PromptContextItem) => boolean
  openComment: (item: PromptContextItem) => void
  remove: (item: PromptContextItem) => void
  onPin: (item: PromptContextItem) => void
  newLayoutDesigns: boolean
  t: (key: ContextItemTranslationKey, params?: Record<string, string | number | boolean>) => string
}

function formatTokens(count: number) {
  if (count >= 1000) return `${Math.round(count / 100) / 10}k`
  return String(count)
}

export const PromptContextItems: Component<ContextItemsProps> = (props) => {
  return (
    <Show when={props.items.length > 0}>
      <div class="flex flex-nowrap items-start gap-2 p-2 overflow-x-auto no-scrollbar">
        <For each={props.items}>
          {(item) => {
            const directory = getDirectory(item.path)
            const filename = getFilename(item.path)
            const label = getFilenameTruncated(item.path, 14)
            const selected = props.active(item)

            return (
              <Dynamic
                component={props.newLayoutDesigns ? TooltipV2 : Tooltip}
                value={
                  <span class="flex max-w-[300px]">
                    <span
                      classList={{
                        "truncate-start [unicode-bidi:plaintext] min-w-0": true,
                        "text-v2-text-text-muted": props.newLayoutDesigns,
                        "text-text-invert-base": !props.newLayoutDesigns,
                      }}
                    >
                      {directory}
                    </span>
                    <span class="shrink-0">{filename}</span>
                  </span>
                }
                placement="top"
                openDelay={800}
              >
                <div
                  classList={{
                    "group shrink-0 flex flex-col rounded-[6px] pl-2 pr-1 py-1 max-w-[200px] h-14 cursor-default transition-all transition-transform shadow-xs-border hover:shadow-xs-border-hover": true,
                    "hover:bg-surface-interactive-weak": !!item.commentID && !selected,
                    "bg-surface-interactive-hover hover:bg-surface-interactive-hover shadow-xs-border-hover": selected,
                    "bg-background-stronger": !selected,
                    "ring-1 ring-border-info": item.pinned,
                  }}
                  onClick={() => props.openComment(item)}
                >
                  <div class="flex items-center gap-1.5">
                    <FileIcon node={{ path: item.path, type: "file" }} class="shrink-0 size-3.5" />
                    <div class="flex items-center text-[12px] min-w-0 font-medium leading-5">
                      <span class="text-text-strong whitespace-nowrap">{label}</span>
                      <Show when={item.selection}>
                        {(sel) => (
                          <span class="text-text-weak whitespace-nowrap shrink-0">
                            {sel().startLine === sel().endLine
                              ? `:${sel().startLine}`
                              : `:${sel().startLine}-${sel().endLine}`}
                          </span>
                        )}
                      </Show>
                    </div>
                    <IconButton
                      type="button"
                      icon={item.pinned ? "pin-active" : "pin"}
                      variant="ghost"
                      class="ml-auto size-3.5 text-text-weak hover:text-text-strong transition-all"
                      classList={{ "text-text-strong": item.pinned }}
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onPin(item)
                      }}
                      aria-label={item.pinned ? props.t("prompt.context.unpin") : props.t("prompt.context.pin")}
                    />
                    <IconButton
                      type="button"
                      icon="close-small"
                      variant="ghost"
                      class="size-3.5 text-text-weak hover:text-text-strong transition-all"
                      onClick={(e) => {
                        e.stopPropagation()
                        props.remove(item)
                      }}
                      aria-label={props.t("prompt.context.removeFile")}
                    />
                  </div>
                  <div class="flex items-center gap-1.5 ml-5 pr-1">
                    <Show when={item.preview}>
                      <span class="text-11-regular text-text-weak shrink-0">
                        {props.t("prompt.context.tokens", { count: String(formatTokens(estimateContextTokens(item))) })}
                      </span>
                    </Show>
                    <Show when={item.comment}>
                      {(comment) => <span class="text-12-regular text-text-strong truncate">{comment()}</span>}
                    </Show>
                  </div>
                </div>
              </Dynamic>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
