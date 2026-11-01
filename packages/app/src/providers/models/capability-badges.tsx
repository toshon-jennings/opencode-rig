import { For, Show } from "solid-js"
import { Badge } from "@opencode/ui/badge"
import { useLanguage } from "@/runtime/i18n/language"
import { modelCapabilityTags, type Capabilities } from "./capabilities"

// Every badge is shrink-0, so the name is the only thing that gives way: callers keep a min-width on it.
export function ModelCapabilityBadges(props: { model: Capabilities }) {
  const language = useLanguage()

  return (
    <>
      <Show when={props.model.limit.context}>
        <Badge class="shrink-0 font-mono uppercase">
          {new Intl.NumberFormat(language.intl(), {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(props.model.limit.context)}
        </Badge>
      </Show>
      <For each={modelCapabilityTags(props.model)}>
        {(tag) => <Badge class="shrink-0">{language.t(`model.tag.${tag}`)}</Badge>}
      </For>
    </>
  )
}
