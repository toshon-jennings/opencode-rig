export * as Connection from "./connection"

import { Schema } from "effect"
import { Credential } from "./credential"

export interface CredentialInfo extends Schema.Schema.Type<typeof CredentialInfo> {}
export const CredentialInfo = Schema.Struct({
  type: Schema.Literal("credential"),
  id: Credential.ID,
  label: Schema.String,
}).annotate({ identifier: "Connection.CredentialInfo" })

export interface EnvInfo extends Schema.Schema.Type<typeof EnvInfo> {}
export const EnvInfo = Schema.Struct({
  type: Schema.Literal("env"),
  name: Schema.String,
}).annotate({ identifier: "Connection.EnvInfo" })

export interface ExternalInfo extends Schema.Schema.Type<typeof ExternalInfo> {}
export const ExternalInfo = Schema.Struct({
  type: Schema.Literal("external"),
  id: Schema.String,
  label: Schema.String,
}).annotate({ identifier: "Connection.ExternalInfo" })

export const Info = Schema.Union([CredentialInfo, EnvInfo, ExternalInfo])
  .pipe(Schema.toTaggedUnion("type"))
  .annotate({ identifier: "Connection.Info" })
export type Info = typeof Info.Type
