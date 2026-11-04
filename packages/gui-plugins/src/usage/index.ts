import { Schema } from "effect"
import { Plugin, Store } from "@opencode/plugin/gui"
import en from "./i18n/en"

const Strip = Schema.Struct({ open: Schema.Boolean, height: Schema.Number })

export default Plugin.define({ stores: { strip: Store.global(Strip, { open: true, height: 220 }) }, i18n: { en } })
