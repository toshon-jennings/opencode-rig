import { expect, test } from "bun:test"

test("keeps the tooltip portal from blocking its trigger", async () => {
  const css = await Bun.file(`${import.meta.dir}/tooltip-v2.css`).text()

  expect(css).toMatch(
    /\[data-popper-positioner\]:has\(\[data-component="tooltip-v2"\]\)\s*\{[^}]*pointer-events:\s*none;/s,
  )
})
