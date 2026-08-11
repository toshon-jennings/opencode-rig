import { createSignal } from "solid-js"
import { pathKey, type PathKey } from "@/utils/path-key"

// Sessions started without a project run in the server's scratch directory
// (`path.scratch`). Registering those directories here lets displayName label
// them without threading the value through every project consumer, and keeps
// the label reactive so the first bootstrap does not leave "scratch" on screen.
const [worktrees, setWorktrees] = createSignal<ReadonlySet<PathKey>>(new Set())
const [label, setLabel] = createSignal("")

export function registerScratchWorktree(worktree: string) {
  if (!worktree) return
  const key = pathKey(worktree)
  if (worktrees().has(key)) return
  setWorktrees((current) => new Set(current).add(key))
}

export function setScratchLabel(value: string) {
  setLabel(value)
}

export function scratchLabel() {
  return label()
}

export function isScratchWorktree(worktree: string) {
  return worktrees().has(pathKey(worktree))
}
