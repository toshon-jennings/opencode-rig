import { SessionReviewHunkBar } from "./session-review-hunk-bar-v2"

export default {
  title: "OpenCode/Review/Hunk bar",
  id: "components-session-review-hunk-bar-v2",
  component: SessionReviewHunkBar,
}

const file = {
  hunks: [
    { id: "a", line: 2 },
    { id: "b", line: 18 },
    { id: "c", line: 143 },
  ],
}

export const Default = {
  render: () => (
    <div
      data-component="session-review-v2"
      style={{ width: "560px", border: "1px solid var(--v2-border-border-base)" }}
    >
      <SessionReviewHunkBar file={file} onApply={() => new Promise<void>((resolve) => setTimeout(resolve, 600))} />
    </div>
  ),
}

export const Narrow = {
  render: () => (
    <div
      data-component="session-review-v2"
      style={{ width: "300px", border: "1px solid var(--v2-border-border-base)" }}
    >
      <SessionReviewHunkBar file={file} onApply={() => Promise.resolve()} />
    </div>
  ),
}
