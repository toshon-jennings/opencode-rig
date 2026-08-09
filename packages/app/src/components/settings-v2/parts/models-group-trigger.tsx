import { Show, type Component } from "solid-js"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"

const PROVIDER_ICON_SIZE = 16

// Shared by the Settings → Models tab and the Manage Models dialog so the two stay
// visually identical. Renders only the trigger; callers own the surrounding <h3> so they
// can place sibling controls (the dialog puts a provider-wide Switch beside it, which must
// not live inside this <button>).
export const ModelsGroupTrigger: Component<{
  providerID: string
  providerName: string
  expanded: boolean
  disabled?: boolean
  onToggle: () => void
}> = (props) => {
  return (
    <button
      type="button"
      class="settings-v2-models-group-trigger"
      aria-expanded={props.expanded}
      disabled={props.disabled}
      onClick={() => props.onToggle()}
    >
      <span class="settings-v2-models-group-chevron">
        <Show
          when={props.expanded}
          fallback={
            <svg width="5" height="6" viewBox="0 0 5 6" fill="none" aria-hidden="true">
              <path
                d="M0.75194 5.31663C0.41861 5.51103 0 5.27063 0 4.88473V0.500754C0 0.114854 0.41861 -0.125577 0.75194 0.0688635L4.5096 2.26084C4.8404 2.45378 4.8404 2.93168 4.5096 3.12462L0.75194 5.31663Z"
                fill="currentColor"
              />
            </svg>
          }
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M5.37624 6.75194C5.18184 6.41861 5.42224 6 5.80814 6H10.1921C10.578 6 10.8184 6.41861 10.624 6.75194L8.43203 10.5096C8.23909 10.8404 7.76119 10.8404 7.56825 10.5096L5.37624 6.75194Z"
              fill="currentColor"
            />
          </svg>
        </Show>
      </span>
      <span class="settings-v2-models-group-label">
        <ProviderIcon
          id={props.providerID}
          width={PROVIDER_ICON_SIZE}
          height={PROVIDER_ICON_SIZE}
          class="settings-v2-models-provider-icon shrink-0"
        />
        <span class="settings-v2-section-title">{props.providerName}</span>
      </span>
    </button>
  )
}
