interface ImportMetaEnv {
  /** The commit a beta desktop build was built from; undefined in every other build. */
  readonly OPENCODE_COMMIT?: string
  /** A beta desktop build's commit, recent history and notes as JSON (packages/desktop/script/beta-notes.ts). */
  readonly OPENCODE_BETA_NOTES?: string
  /** The upstream OpenCode release the fork is based on (root package.json `upstreamBase`). */
  readonly OPENCODE_UPSTREAM_VERSION?: string
}
