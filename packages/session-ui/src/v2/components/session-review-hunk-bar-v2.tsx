import { useI18n } from "@opencode/ui/context/i18n"
import { createEffect, createMemo, For, on, Show } from "solid-js"
import { createStore } from "solid-js/store"
import "./session-review-v2.css"

/** One file's hunks as the server captured them; `line` is where the first changed line sits in the file. */
export type SessionReviewHunkFile = {
  readonly hunks: readonly { readonly id: string; readonly line: number }[]
}

export type SessionReviewHunkApply = (operation: "accept" | "reject", hunkIDs: [string, ...string[]]) => Promise<void>

/**
 * Pick hunks of the open file, then keep them (and undo the rest of the file) or undo them. Both rewrite the file
 * on disk with no way back, so each asks once before acting.
 */
export function SessionReviewHunkBar(props: { file: SessionReviewHunkFile; onApply: SessionReviewHunkApply }) {
  const i18n = useI18n()
  const [state, setState] = createStore({
    // Picked by line, not id: a file change recaptures the review and gives the same hunks new ids.
    lines: [] as number[],
    confirm: undefined as "accept" | "reject" | undefined,
    busy: false,
  })

  const selected = createMemo(() => props.file.hunks.filter((hunk) => state.lines.includes(hunk.line)))

  createEffect(
    on(
      () => props.file.hunks.map((hunk) => hunk.line).join(),
      () => setState({ lines: [], confirm: undefined }),
      { defer: true },
    ),
  )

  const toggle = (line: number) =>
    setState({
      lines: state.lines.includes(line) ? state.lines.filter((value) => value !== line) : [...state.lines, line],
      confirm: undefined,
    })

  const run = async () => {
    const [first, ...rest] = selected().map((hunk) => hunk.id)
    const operation = state.confirm

    if (!first || !operation) return
    setState("busy", true)
    await props
      .onApply(operation, [first, ...rest])
      .finally(() => setState({ busy: false, confirm: undefined, lines: [] }))
  }

  return (
    <div data-slot="session-review-v2-hunks" role="group" aria-label={i18n.t("ui.sessionReviewV2.hunks")}>
      <For each={props.file.hunks}>
        {(hunk) => (
          <button
            type="button"
            data-slot="session-review-v2-hunk"
            aria-pressed={state.lines.includes(hunk.line)}
            aria-label={i18n.t("ui.sessionReviewV2.hunkAria", { line: hunk.line })}
            disabled={state.busy}
            onClick={() => toggle(hunk.line)}
          >
            {i18n.t("ui.sessionReviewV2.hunk", { line: hunk.line })}
          </button>
        )}
      </For>
      <Show when={selected().length > 0}>
        <Show
          when={state.confirm}
          fallback={
            <>
              <button
                type="button"
                data-slot="session-review-v2-hunk-action"
                onClick={() => setState("confirm", "accept")}
              >
                {i18n.t("ui.sessionReviewV2.hunks.keep")}
              </button>
              <button
                type="button"
                data-slot="session-review-v2-hunk-action"
                data-tone="danger"
                onClick={() => setState("confirm", "reject")}
              >
                {i18n.t("ui.sessionReviewV2.hunks.undo")}
              </button>
            </>
          }
        >
          {(operation) => (
            <div data-slot="session-review-v2-hunk-confirm" role="alert">
              <span>
                {operation() === "reject"
                  ? i18n.t("ui.sessionReviewV2.hunks.confirmUndo")
                  : i18n.t("ui.sessionReviewV2.hunks.confirmKeep")}
              </span>
              <button
                type="button"
                data-slot="session-review-v2-hunk-action"
                data-tone="danger"
                disabled={state.busy}
                onClick={run}
              >
                {operation() === "reject"
                  ? i18n.t("ui.sessionReviewV2.hunks.undoAction")
                  : i18n.t("ui.sessionReviewV2.hunks.keepAction")}
              </button>
              <button
                type="button"
                data-slot="session-review-v2-hunk-action"
                disabled={state.busy}
                onClick={() => setState("confirm", undefined)}
              >
                {i18n.t("ui.sessionReviewV2.hunks.cancel")}
              </button>
            </div>
          )}
        </Show>
      </Show>
    </div>
  )
}
