import { createMemo } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"

export function SteerChip(props: { mode: "steer" | "queue"; onClick: () => void }) {
  const language = useLanguage()
  const label = createMemo(() =>
    props.mode === "queue" ? language.t("session.timeline.queue") : language.t("session.timeline.steer"),
  )
  const hint = createMemo(() =>
    props.mode === "queue" ? language.t("session.timeline.queueHint") : language.t("session.timeline.steerHint"),
  )

  return (
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-md border border-border-weak-base bg-background-stronger px-2 py-0.5 text-12-medium text-text-weak hover:text-text-base hover:border-border-base transition-colors cursor-pointer"
      aria-label={hint()}
      onClick={props.onClick}
    >
      <Icon name="edit" size="small" />
      {label()}
    </button>
  )
}
