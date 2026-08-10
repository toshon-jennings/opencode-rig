import { expect, test } from "bun:test"

test("keeps panel edges easy to acquire without widening the visible divider", async () => {
  const css = await Bun.file(`${import.meta.dir}/resize-handle.css`).text()

  expect(css).toMatch(/\[data-direction="horizontal"\][^}]*width:\s*16px;[^}]*cursor:\s*col-resize;/s)
  expect(css).toMatch(/\[data-direction="vertical"\][^}]*height:\s*16px;[^}]*cursor:\s*row-resize;/s)
  expect(css).toMatch(/&::after\s*\{[^}]*width:\s*3px;/s)
  expect(css).toMatch(/&::after\s*\{[^}]*height:\s*3px;/s)
})
