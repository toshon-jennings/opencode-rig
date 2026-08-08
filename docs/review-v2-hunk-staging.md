# Review v2 selected-hunk staging

Review v2 supports selected-hunk accept and reject only for the live working-tree review source. Branch comparisons and turn/session
snapshots remain read-only because they do not identify a mutable working-tree revision.

The server captures the current working-tree diff into a location-scoped, opaque revision. Each captured file and hunk has a
server-issued ID; the client can submit only those IDs with an `accept` or `reject` operation. It cannot submit a patch or a path.

Before a mutation, the Core service locks the repository, verifies that both `HEAD` and the complete working-tree diff still match
the captured revision, and checks the reverse application before writing. Duplicate selected IDs are treated as overlapping, and a
changed revision is stale. Both conditions return a conflict without changing the worktree.

Reject reverse-applies the selected captured hunks. Accept reverse-applies unselected captured hunks only in files containing a
selected hunk, leaving unrelated working-tree files unchanged. A successful operation returns a freshly captured revision for the
UI.

The contract is implemented as a location-scoped Core service and Protocol/Server endpoint rather than extending `SessionRevert`
or legacy `Vcs.apply`. Core tests exercise accept, reject, stale-state conflict, and overlapping-selection conflict against a real
temporary Git repository.
