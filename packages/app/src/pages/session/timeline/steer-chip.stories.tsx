// @ts-nocheck
import { createSignal, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"

function SteerChip(props: { mode: "steer" | "queue"; onClick: () => void }) {
  const label = () => (props.mode === "queue" ? "Queue" : "Steer")
  const hint = () => (props.mode === "queue" ? "Type a follow-up to send after this response" : "Type to redirect this response")

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

function SteerChipDemo() {
  const [mode, setMode] = createSignal<"steer" | "queue">("steer")
  const [clicked, setClicked] = createSignal(false)

  return (
    <div class="flex flex-col gap-4 p-6">
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1 rounded text-13-medium cursor-pointer"
          classList={{
            "bg-background-stronger text-text-strong": mode() === "steer",
            "text-text-weak": mode() !== "steer",
          }}
          onClick={() => setMode("steer")}
        >
          Steer mode
        </button>
        <button
          class="px-3 py-1 rounded text-13-medium cursor-pointer"
          classList={{
            "bg-background-stronger text-text-strong": mode() === "queue",
            "text-text-weak": mode() !== "queue",
          }}
          onClick={() => setMode("queue")}
        >
          Queue mode
        </button>
      </div>

      <div class="rounded-lg border border-border-weak-base bg-surface-base p-4">
        <div class="pb-2">
          <SteerChip mode={mode()} onClick={() => setClicked(true)} />
        </div>
        <div class="text-13-regular text-text-base">Assistant response streaming...</div>
      </div>

      <Show when={clicked()}>
        <div class="text-12-regular text-text-weak">Chip clicked — would focus the composer</div>
      </Show>
    </div>
  )
}

export default {
  title: "App/Timeline/SteerChip",
  id: "app-timeline-steer-chip",
  tags: ["autodocs"],
}

export const Basic = {
  render: () => <SteerChipDemo />,
}
