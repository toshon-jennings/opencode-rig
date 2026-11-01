import { execFile } from "node:child_process"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { Schema } from "effect"
import { UsageRow } from "./contract"

const run = promisify(execFile)

const decode = Schema.decodeUnknownSync(Schema.Array(UsageRow))

// Assistant messages sit in two tables. Releases before 2.0 wrote `message` (`modelID`, `providerID`); 2.x writes
// `session_message` and copies the old rows into it under the same ids, so each source is read by id and a message
// counted once. A database that has only the old table (an older channel's) contributes just that.
const sources = {
  session_message: (db: string) => `SELECT id,
      json_extract(data, '$.model.id') AS model, json_extract(data, '$.model.providerID') AS provider,
      json_extract(data, '$.tokens.input') AS input, json_extract(data, '$.tokens.output') AS output,
      json_extract(data, '$.tokens.reasoning') AS reasoning, json_extract(data, '$.tokens.cache.read') AS cacheRead,
      json_extract(data, '$.tokens.cache.write') AS cacheWrite, json_extract(data, '$.cost') AS cost
    FROM ${db}.session_message WHERE type = 'assistant'`,
  message: (db: string) => `SELECT id,
      json_extract(data, '$.modelID') AS model, json_extract(data, '$.providerID') AS provider,
      json_extract(data, '$.tokens.input') AS input, json_extract(data, '$.tokens.output') AS output,
      json_extract(data, '$.tokens.reasoning') AS reasoning, json_extract(data, '$.tokens.cache.read') AS cacheRead,
      json_extract(data, '$.tokens.cache.write') AS cacheWrite, json_extract(data, '$.cost') AS cost
    FROM ${db}.message WHERE json_extract(data, '$.role') = 'assistant'`,
}

/** The database files next to `database`: OpenCode keeps one per release channel, so one build sees a slice. */
async function databases(database: string) {
  const directory = path.dirname(database)
  const names = await readdir(directory).catch(() => [])
  const files = names.filter((name) => /^opencode.*\.db$/.test(name)).map((name) => path.join(directory, name))
  const sizes = await Promise.all(files.map((file) => stat(file).then((info) => info.size, () => 0)))

  return files.filter((_, index) => sizes[index] > 0)
}

// An empty target is a temporary database. Reads are `mode=ro`, and a hard stop applies: the databases run to gigabytes.
const sqlite = (target: string, sql: string) =>
  run("sqlite3", ["-json", target && `file:${target}?mode=ro`, sql], { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 }).then(
    (result) => (result.stdout.trim() ? (JSON.parse(result.stdout) as unknown) : []),
  )

/**
 * Totals per model and provider across every OpenCode database beside `database`, most input first.
 *
 * @throws When no database holds assistant messages, or `sqlite3` is missing.
 */
export async function readUsage(database: string) {
  const selects = await databases(database).then((files) =>
    Promise.all(
      files.map(async (file, index) => {
        const tables = await sqlite(file, "SELECT name FROM sqlite_master WHERE name IN ('message', 'session_message')")
        const names = new Set((tables as { name: string }[]).map((table) => table.name))
        const alias = `db${index}`

        return { file, alias, tables: (["session_message", "message"] as const).filter((name) => names.has(name)) }
      }),
    ),
  ).then((list) => list.filter((entry) => entry.tables.length > 0))

  if (selects.length === 0) throw new Error(`No OpenCode database with usage data found in ${path.dirname(database)}`)

  const attach = selects.map((entry) => `ATTACH DATABASE 'file:${entry.file.replaceAll("'", "''")}?mode=ro' AS ${entry.alias};`)
  const union = selects.flatMap((entry) => entry.tables.map((table) => sources[table](entry.alias))).join(" UNION ALL ")
  // One row per message id; copies of the same message hold the same numbers.
  const sql = `${attach.join("")}
    SELECT COALESCE(model, 'unknown') AS model, COALESCE(provider, 'unknown') AS provider, COUNT(*) AS msgs,
      COALESCE(SUM(input), 0) AS input, COALESCE(SUM(output), 0) AS output, COALESCE(SUM(reasoning), 0) AS reasoning,
      COALESCE(SUM(cacheRead), 0) AS cacheRead, COALESCE(SUM(cacheWrite), 0) AS cacheWrite, COALESCE(SUM(cost), 0) AS cost
    FROM (SELECT * FROM (${union}) GROUP BY id)
    GROUP BY model, provider ORDER BY input DESC`

  return decode(await sqlite("", sql))
}
