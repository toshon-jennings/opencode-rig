import { app } from "electron"

type Channel = "dev" | "beta" | "prod"
const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: Channel = raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev"

// Squirrel.Mac verifies an update's code signature against the running app, so an
// unsigned build can download an update but never apply it. Until releases are signed
// with a Developer ID, check-and-link is the only honest behaviour on macOS.
// Flip to "install" once the release workflow runs with Apple credentials.
export const UPDATER_MODE: "install" | "notify" = "notify"
