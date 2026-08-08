# Review v2 hunk staging follow-up

Review v2 receives file diffs from three different sources: the working tree, a branch comparison, and session snapshots.
The current `SessionRevert` operation is deliberately not a generic patch API: it restores complete files from a session boundary
snapshot and updates that boundary's durable revert state. Reusing it for review-file or hunk actions would silently make a git or
branch review mutate unrelated session files, so this change leaves the existing session-level revert flow unchanged.

The safe fallback in this release is therefore the existing whole-session revert flow. Per-file controls are not rendered in the
review sidebar because they would promise a scope the current server operation cannot uphold.

## Required contract for partial hunk staging

A follow-up should add a dedicated review mutation endpoint, not extend `SessionRevert`:

- The server creates an opaque review revision from its own captured diff and records the base worktree revision plus per-file patch.
- The client sends that revision and selected server-issued hunk IDs with an explicit `accept` or `reject` operation. It must never
  send a client-authored patch.
- Before mutating, the server verifies the captured base and runs a checked application of only the selected hunks. A stale base,
  an overlapping selected hunk, or a failed check returns a conflict without writing the working tree.
- Reject reverse-applies the selected captured hunks; accept applies them only when they were previously rejected in that revision.
  Every successful mutation returns a fresh review revision for the UI to render.

Core coverage must exercise a clean subset apply, reject, stale-base conflict, and overlapping-hunk conflict against a real temporary
git worktree. The endpoint will change the public Protocol/Server HttpApi, so regenerate `packages/client` from that package when the
contract is implemented.
