// Release coordinates for this fork, shared by the packaging config (which writes them
// into the app's update feed) and the runtime updater (which links users to the release
// page). Must NOT point at anomalyco/*: the updater resolves updates from here, so
// upstream's releases would be offered to fork users and replace this build.
export const FORK_OWNER = "toshon-jennings"
export const FORK_REPO = "opencode-workbench"

export const releasesUrl = `https://github.com/${FORK_OWNER}/${FORK_REPO}/releases`

export function releaseUrl(version: string) {
  return `${releasesUrl}/tag/v${version}`
}
