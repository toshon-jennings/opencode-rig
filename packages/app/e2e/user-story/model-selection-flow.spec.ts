import { expect, test, type Page } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const directory = "C:/OpenCode/NewProject"

test("creates a session in a new project, connects OpenCode Go, and selects its model", async ({ page }) => {
  let connectedGo = false
  let pendingGo = false
  const connections: Array<{ integrationID: string; body: unknown }> = []

  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: "proj_model_selection_flow",
      worktree: directory,
      vcs: "git",
      name: "NewProject",
      time: { created: 1_700_000_000_000, updated: 1_700_000_000_000 },
      sandboxes: [],
    },
    provider: () => ({
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: {
            "free-model": {
              id: "free-model",
              name: "Free Model",
              cost: { input: 0, output: 0 },
              limit: { context: 200_000 },
            },
          },
        },
        {
          id: "opencode-go",
          name: "OpenCode Go",
          models: {
            "go-model-1": {
              id: "go-model-1",
              name: "Go Model 1",
              cost: { input: 1, output: 1 },
              limit: { context: 200_000 },
            },
          },
        },
      ],
      connected: connectedGo ? ["opencode", "opencode-go"] : ["opencode"],
      default: { providerID: "opencode", modelID: "free-model" },
    }),
    integrationMethods: { "opencode-go": [{ type: "api", label: "API key" }] },
    onConnectKey: (input) => {
      connections.push(input)
      if (input.integrationID === "opencode-go") pendingGo = true
    },
    onInstanceDispose: () => {
      if (pendingGo) connectedGo = true
    },
    sessions: [],
    pageMessages: () => ({ items: [] }),
    fileList: (path) =>
      path ? [] : [{ name: "NewProject", path: "NewProject", absolute: directory, type: "directory", ignored: false }],
    findFiles: () => ["NewProject"],
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem("opencode.global.dat:server", JSON.stringify({ projects: { local: [] } }))
  })

  await openNewProjectSession(page)

  const modelControl = page.locator('[data-action="prompt-model"]')
  await modelControl.click()
  await expect(page.locator('[data-section="free-models"]')).toContainText("Free models provided by OpenCode")

  await page.locator('[data-provider-id="opencode-go"]').click()
  await page.locator('[data-input="provider-api-key"]').fill("mock-go-api-key")
  await page.locator('[data-action="provider-connect-submit"]').click()
  await expect(page.locator('[data-component="dialog-v2"]')).toHaveCount(0)
  expect(connections).toEqual([{ integrationID: "opencode-go", body: { type: "api", key: "mock-go-api-key" } }])

  await expect(modelControl).toHaveAttribute("data-control-type", "popover")
  await modelControl.click()
  const goModel = page.locator('[data-option-key="opencode-go:go-model-1"]')
  await expect(goModel).toBeVisible()
  await goModel.click()

  await expect(modelControl).toContainText("Go Model 1")
})

test("defaults new users to free LongCat on OpenCode Zen", async ({ page }) => {
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: "proj_default_model_flow",
      worktree: directory,
      vcs: "git",
      name: "NewProject",
      time: { created: 1_700_000_000_000, updated: 1_700_000_000_000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: {
            sonnet: {
              id: "sonnet",
              name: "Sonnet",
              cost: { input: 3, output: 15 },
              release_date: "2026-07-01",
              limit: { context: 200_000 },
            },
          },
        },
        {
          id: "opencode",
          name: "OpenCode Zen",
          models: {
            "paid-model": {
              id: "paid-model",
              name: "Paid Model",
              cost: { input: 1, output: 1 },
              release_date: "2025-01-01",
              limit: { context: 200_000 },
            },
            "longcat-2.0-free": {
              id: "longcat-2.0-free",
              name: "LongCat-2.0 Free",
              cost: { input: 0, output: 0 },
              release_date: "2025-01-01",
              limit: { context: 200_000 },
            },
            "other-free": {
              id: "other-free",
              name: "Other Free",
              cost: { input: 0, output: 0 },
              release_date: "2025-01-01",
              limit: { context: 200_000 },
            },
          },
        },
      ],
      connected: ["anthropic", "opencode"],
      default: { anthropic: "sonnet", opencode: "paid-model" },
    },
    sessions: [],
    pageMessages: () => ({ items: [] }),
    fileList: (path) =>
      path ? [] : [{ name: "NewProject", path: "NewProject", absolute: directory, type: "directory", ignored: false }],
    findFiles: () => ["NewProject"],
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem("opencode.global.dat:server", JSON.stringify({ projects: { local: [] } }))
  })

  await openNewProjectSession(page)

  const modelControl = page.locator('[data-action="prompt-model"]')
  await expect(modelControl).toContainText("LongCat-2.0 Free")
  await modelControl.click()
  await expect(page.locator('[data-option-key="opencode:longcat-2.0-free"]')).toBeVisible()
  await expect(page.locator('[data-option-key="opencode:other-free"]')).toBeVisible()
  await expect(page.locator('[data-option-key="opencode:paid-model"]')).toHaveCount(0)
})

async function openNewProjectSession(page: Page) {
  await page.goto("/")
  const addProject = page.locator('[data-action="home-add-project-row"]')
  await expectAppVisible(addProject)
  await addProject.click()
  await page.locator("[data-directory-path]").click()
  await page.locator('[data-action="home-new-session"]').click()
  await expectAppVisible(page.locator('[data-component="prompt-input-v2"]'))
}
