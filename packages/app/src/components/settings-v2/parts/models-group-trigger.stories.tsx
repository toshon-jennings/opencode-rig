import { createSignal } from "solid-js"
import { ModelsGroupTrigger } from "./models-group-trigger"
import "../settings-v2.css"

export default {
  title: "App/Settings/ModelsGroupTrigger",
  id: "app-settings-models-group-trigger",
  tags: ["autodocs"],
}

export const Collapsed = {
  render: () => (
    <div class="settings-v2-panel settings-v2-models p-4">
      <div class="settings-v2-section" data-component="settings-models-provider">
        <h3 class="settings-v2-models-group-header justify-between">
          <ModelsGroupTrigger providerID="anthropic" providerName="Anthropic" expanded={false} onToggle={() => {}} />
        </h3>
      </div>
    </div>
  ),
}

export const Expanded = {
  render: () => (
    <div class="settings-v2-panel settings-v2-models p-4">
      <div class="settings-v2-section" data-component="settings-models-provider" data-expanded="">
        <h3 class="settings-v2-models-group-header justify-between">
          <ModelsGroupTrigger providerID="anthropic" providerName="Anthropic" expanded onToggle={() => {}} />
        </h3>
      </div>
    </div>
  ),
}

// Search disables the trigger because results are force-expanded; a user must not be able
// to collapse a group out from under their own search.
export const DisabledWhileSearching = {
  render: () => (
    <div class="settings-v2-panel settings-v2-models p-4">
      <div class="settings-v2-section" data-component="settings-models-provider" data-expanded="">
        <h3 class="settings-v2-models-group-header justify-between">
          <ModelsGroupTrigger providerID="openai" providerName="OpenAI" expanded disabled onToggle={() => {}} />
        </h3>
      </div>
    </div>
  ),
}

export const Interactive = {
  render: () => {
    const [open, setOpen] = createSignal(false)
    return (
      <div class="settings-v2-panel settings-v2-models p-4">
        <div
          class="settings-v2-section"
          data-component="settings-models-provider"
          data-expanded={open() ? "" : undefined}
        >
          <h3 class="settings-v2-models-group-header justify-between">
            <ModelsGroupTrigger
              providerID="google"
              providerName="Google"
              expanded={open()}
              onToggle={() => setOpen(!open())}
            />
          </h3>
        </div>
      </div>
    )
  },
}
