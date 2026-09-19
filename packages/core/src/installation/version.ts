declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
  const OPENCODE_UPSTREAM_VERSION: string
}

export const InstallationVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

// The anomalyco/opencode release this fork is rebased on, baked in from the root package.json's
// `upstreamBase` at build time. opencode Zen gates features on upstream's version line, so this
// fork's independent version reads as ancient to it; report the base we actually ship instead.
// Keep the fallback in sync with `upstreamBase` for unbundled dev runs.
export const InstallationUpstreamVersion =
  typeof OPENCODE_UPSTREAM_VERSION === "string" ? OPENCODE_UPSTREAM_VERSION : "1.18.14"
