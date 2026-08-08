// @ts-nocheck
import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { onMount } from "solid-js"
import { DialogSelectMcp, McpServerInspector } from "./dialog-select-mcp"

function SelectMcpDialogStory() {
  const dialog = useDialog()
  const open = () => dialog.show(() => <DialogSelectMcp />)

  onMount(open)

  return (
    <Button variant="secondary" onClick={open}>
      Open MCP select dialog
    </Button>
  )
}

export default {
  title: "App/Dialogs/Select MCP",
  id: "app-dialog-select-mcp",
}

export const Default = {
  render: () => <SelectMcpDialogStory />,
}

export const InspectorConnected = {
  render: () => (
    <div class="w-96 p-4 bg-background-base rounded-lg border border-border-weak-base">
      <McpServerInspector
        serverName="github"
        status="connected"
        tools={[
          {
            id: "github_create_issue",
            description: "Create a new issue in a repository",
            parameters: {
              type: "object",
              properties: {
                repo: { type: "string", description: "Repository full name" },
                title: { type: "string", description: "Issue title" },
                body: { type: "string", description: "Issue body content" },
              },
              required: ["repo", "title"],
            },
          },
        ]}
      />
    </div>
  ),
}

export const InspectorDisconnected = {
  render: () => (
    <div class="w-96 p-4 bg-background-base rounded-lg border border-border-weak-base">
      <McpServerInspector serverName="github" status="disabled" tools={[]} />
    </div>
  ),
}
