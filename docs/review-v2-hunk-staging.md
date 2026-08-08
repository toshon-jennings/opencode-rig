# Review v2 hunk staging follow-up

Review v2 receives file diffs from three different sources: the working tree, a branch comparison, and session snapshots. There is
not currently a safe per-file fallback for those sources, so the review sidebar intentionally does not render accept or reject
controls.

This is a code-level boundary rather than a missing UI wiring:

- `packages/app/src/pages/session.tsx` loads working-tree and branch review data through the legacy `sdk().api.vcs.diff` client.
  `packages/opencode/src/project/vcs.ts` produces those results from Git status and a base ref, but does not issue a revision or
  retain a captured patch.
- That legacy API only exposes `Vcs.apply({ patch })`. It forwards a client-supplied patch directly to `git apply`; it has no
  selected-file constraint, reverse operation, base revision, stale-result check, or mutation result that can refresh the review
  state. Reusing it would turn a review button into an arbitrary patch application endpoint.
- The V2 `SessionRevert.stage` endpoint accepts only a session `messageID` and a Boolean `files` switch. Its planner finds every
  assistant snapshot after that message, while its clear path restores every staged path from the captured session snapshot. It
  cannot select one review file, and its session boundary has no identity relationship to a working-tree or branch diff.
- Turn review comes from `lastUserMessage()?.summary?.diffs`, not from a V2 session-revert boundary. Branch review comes from the
  legacy VCS merge base. Neither source can truthfully be submitted to `SessionRevert`.

Binding any of these paths to session-history revert would allow a click on one displayed file to restore additional files from a
different session boundary. Binding it to `Vcs.apply` would allow the client to substitute a patch after the diff was displayed.
Both violate the scope promised by per-file staging.

## Required contract for partial hunk staging

A follow-up should add a dedicated review mutation endpoint, not extend `SessionRevert`:

- The server creates an opaque review revision from its own captured diff and records the location, repository base revision,
  source mode, per-file patch, hunk direction, and current decision state.
- The client sends that revision and selected server-issued hunk IDs with an explicit `accept` or `reject` operation. It must never
  send a client-authored patch or a raw path.
- Before mutating, the server verifies the captured base and runs a checked application of only the selected hunks. A stale base,
  an overlapping selected hunk, or a failed check returns a conflict without writing the working tree.
- Reject reverse-applies the selected captured hunks; accept applies them only when they were previously rejected in that revision.
  Every successful mutation returns a fresh review revision for the UI to render.

The smallest safe implementation is a new location-scoped Core review-mutation service and a Protocol/Server endpoint. It must not
extend `SessionRevert` or legacy `Vcs.apply`. Core coverage must exercise a clean subset apply, reject, stale-base conflict, and
overlapping-hunk conflict against a real temporary Git worktree. The endpoint will change the public Protocol/Server HttpApi, so
regenerate `packages/client` from that package when the contract is implemented.
