export * as Review from "./review"

import { Schema } from "effect"
import { RelativePath } from "./schema"

export const RevisionID = Schema.String.pipe(Schema.brand("Review.RevisionID"))
export type RevisionID = typeof RevisionID.Type

export const FileID = Schema.String.pipe(Schema.brand("Review.FileID"))
export type FileID = typeof FileID.Type

export const HunkID = Schema.String.pipe(Schema.brand("Review.HunkID"))
export type HunkID = typeof HunkID.Type

export const Hunk = Schema.Struct({
  id: HunkID,
}).annotate({ identifier: "Review.Hunk" })
export interface Hunk extends Schema.Schema.Type<typeof Hunk> {}

export const File = Schema.Struct({
  id: FileID,
  path: RelativePath,
  hunks: Schema.Array(Hunk),
}).annotate({ identifier: "Review.File" })
export interface File extends Schema.Schema.Type<typeof File> {}

export const Revision = Schema.Struct({
  id: RevisionID,
  files: Schema.Array(File),
}).annotate({ identifier: "Review.Revision" })
export interface Revision extends Schema.Schema.Type<typeof Revision> {}

export const Operation = Schema.Literals(["accept", "reject"])
export type Operation = typeof Operation.Type

export const Mutation = Schema.Struct({
  operation: Operation,
  hunkIDs: Schema.NonEmptyArray(HunkID),
}).annotate({ identifier: "Review.Mutation" })
export interface Mutation extends Schema.Schema.Type<typeof Mutation> {}
