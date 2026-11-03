import { For } from "solid-js"
import { RigMark } from "@opencode/ui/rig-mark"
import { usePlugin } from "@opencode/plugin/gui"
import type definition from "./index"

// A diff's own marks: "+" for what Rig adds to OpenCode, "~" for what it changes.
const differences = [
  { id: "usage", mark: "+" },
  { id: "github", mark: "+" },
  { id: "mcpTools", mark: "+" },
  { id: "projectless", mark: "+" },
  { id: "badges", mark: "+" },
  { id: "defaults", mark: "~" },
  { id: "updates", mark: "~" },
] as const

/** Settings > About OpenCode Rig: how the fork differs from upstream. OpenCode's own credits stay on About. */
export default function RigAboutPage() {
  const ctx = usePlugin<typeof definition>()

  return (
    <div class="settings-tab-body flex max-w-[560px] flex-col gap-10 pt-6 text-v2-text-text-base">
      <header class="flex flex-col gap-5">
        <RigMark class="h-14 w-auto self-start" />
        <div class="flex flex-col gap-1">
          <span class="font-mono text-[20px] leading-7 tabular-nums">{ctx.app.version}</span>
          <span class="text-[13px] leading-5 text-v2-text-text-muted">
            {ctx.t("version.base", { version: import.meta.env.OPENCODE_UPSTREAM_VERSION ?? "" })}
          </span>
        </div>
      </header>

      <section class="flex flex-col">
        <h3 class="pb-3 text-[15px] font-medium leading-6">{ctx.t("differences.title")}</h3>
        <ul class="flex flex-col border-t border-v2-border-border-base">
          <For each={differences}>
            {(item) => (
              <li class="grid grid-cols-[1.25rem_1fr] gap-x-2 border-b border-v2-border-border-base py-3">
                <span class="font-mono text-[15px] font-medium leading-5 text-v2-text-text-base" aria-hidden="true">
                  {item.mark}
                </span>
                <div class="flex min-w-0 flex-col gap-0.5">
                  <span class="text-[13px] font-medium leading-5">
                    <span class="sr-only">
                      {ctx.t(item.mark === "+" ? "differences.added" : "differences.changed")}
                      {": "}
                    </span>
                    {ctx.t(`difference.${item.id}.title`)}
                  </span>
                  <span class="text-[13px] leading-5 text-v2-text-text-muted">
                    {ctx.t(`difference.${item.id}.body`)}
                  </span>
                </div>
              </li>
            )}
          </For>
        </ul>
      </section>

      <footer class="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] leading-5 text-v2-text-text-muted">
        <span>{ctx.t("credits.note")}</span>
        <button
          type="button"
          class="underline underline-offset-2 hover:text-v2-text-text-base focus-visible:outline-none focus-visible:text-v2-text-text-base"
          onClick={() => ctx.system.openExternal("https://github.com/anomalyco/opencode")}
        >
          {ctx.t("link.upstream")}
        </button>
      </footer>
    </div>
  )
}
