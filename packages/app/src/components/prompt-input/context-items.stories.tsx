import { createSignal } from "solid-js"
import { PromptContextItems } from "./context-items"
import type { ContextItem } from "@/context/prompt"

type PromptContextItem = ContextItem & { key: string }

function ContextItemsDemo() {
  const [items, setItems] = createSignal<PromptContextItem[]>([
    {
      key: "file:src/index.ts:1:10",
      type: "file",
      path: "src/index.ts",
      selection: { startLine: 1, startChar: 0, endLine: 10, endChar: 0 },
      preview: "const x = 1\n".repeat(50),
      pinned: false,
    },
    {
      key: "file:src/utils/helper.ts:5:15",
      type: "file",
      path: "src/utils/helper.ts",
      selection: { startLine: 5, startChar: 0, endLine: 15, endChar: 0 },
      preview: "export function helper() {\n  return true\n}\n".repeat(100),
      pinned: true,
    },
    {
      key: "file:README.md",
      type: "file",
      path: "README.md",
      preview: "# Project\n\nThis is a long document.\n".repeat(200),
      comment: "Check the install section",
      pinned: false,
    },
  ])

  const t = (key: string, params?: Record<string, string | number | boolean>) => {
    if (key === "prompt.context.tokens" && params) return `${params.count}t`
    if (key === "prompt.context.pin") return "Pin context"
    if (key === "prompt.context.unpin") return "Unpin context"
    if (key === "prompt.context.removeFile") return "Remove file from context"
    return key
  }

  const [activeKey, setActiveKey] = createSignal<string>()
  const active = (item: PromptContextItem) => item.key === activeKey()

  const togglePin = (item: PromptContextItem) => {
    setItems((prev) => prev.map((entry) => (entry.key === item.key ? { ...entry, pinned: !entry.pinned } : entry)))
  }

  const remove = (item: PromptContextItem) => {
    setItems((prev) => prev.filter((entry) => entry.key !== item.key))
  }

  return (
    <div class="flex flex-col gap-4 p-6">
      <PromptContextItems
        items={items()}
        active={active}
        openComment={(item) => setActiveKey(item.key)}
        remove={remove}
        onPin={togglePin}
        newLayoutDesigns={false}
        t={t}
      />
      <div class="text-12-regular text-text-weak">
        Pinned: {items().filter((i) => i.pinned).length} / {items().length}
      </div>
    </div>
  )
}

export default {
  title: "App/PromptInput/ContextItems",
  id: "app-prompt-input-context-items",
  tags: ["autodocs"],
}

export const Basic = {
  render: () => <ContextItemsDemo />,
}
