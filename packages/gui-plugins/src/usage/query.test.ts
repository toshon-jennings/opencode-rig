import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { readUsage } from "./query"

const legacy = (id: string, model: string, input: number, cost: number) => [
  id,
  JSON.stringify({
    role: "assistant",
    modelID: model,
    providerID: "opencode",
    cost,
    tokens: { input, output: 1, reasoning: 2, cache: { read: 3, write: 4 } },
  }),
]

const v2 = (id: string, model: string, input: number, cost: number) => [
  id,
  JSON.stringify({
    model: { id: model, providerID: "opencode" },
    cost,
    tokens: { input, output: 1, reasoning: 2, cache: { read: 3, write: 4 } },
  }),
]

async function withDirectory<A>(run: (directory: string) => Promise<A>) {
  const directory = await mkdtemp(path.join(tmpdir(), "usage-"))

  return run(directory).finally(() => rm(directory, { recursive: true, force: true }))
}

function database(file: string, setup: (db: Database) => void) {
  const db = new Database(file)
  setup(db)
  db.close()
}

test("counts a message once when 2.x copied it into session_message, and keeps messages only the old table has", () =>
  withDirectory(async (directory) => {
    database(path.join(directory, "opencode.db"), (db) => {
      db.run("CREATE TABLE message (id text primary key, data text)")
      db.run("CREATE TABLE session_message (id text primary key, type text, data text)")
      // m1 was copied, m2 only exists in the old table, m3 was written by 2.x.
      db.run("INSERT INTO message VALUES (?, ?)", legacy("m1", "alpha", 100, 1))
      db.run("INSERT INTO message VALUES (?, ?)", legacy("m2", "alpha", 10, 0.5))
      db.run("INSERT INTO session_message VALUES (?, 'assistant', ?)", v2("m1", "alpha", 100, 1))
      db.run("INSERT INTO session_message VALUES (?, 'assistant', ?)", v2("m3", "beta", 7, 0))
      db.run("INSERT INTO session_message VALUES ('u1', 'user', '{}')")
    })

    expect(await readUsage(path.join(directory, "opencode.db"))).toEqual([
      { model: "alpha", provider: "opencode", msgs: 2, input: 110, output: 2, reasoning: 4, cacheRead: 6, cacheWrite: 8, cost: 1.5 },
      { model: "beta", provider: "opencode", msgs: 1, input: 7, output: 1, reasoning: 2, cacheRead: 3, cacheWrite: 4, cost: 0 },
    ])
  }))

test("adds the other channels' databases, and skips empty files", () =>
  withDirectory(async (directory) => {
    database(path.join(directory, "opencode.db"), (db) => {
      db.run("CREATE TABLE message (id text primary key, data text)")
      db.run("INSERT INTO message VALUES (?, ?)", legacy("a", "alpha", 5, 0))
    })
    database(path.join(directory, "opencode-dev.db"), (db) => {
      db.run("CREATE TABLE message (id text primary key, data text)")
      db.run("INSERT INTO message VALUES (?, ?)", legacy("b", "alpha", 6, 0))
      // The same message in two channels' files counts once.
      db.run("INSERT INTO message VALUES (?, ?)", legacy("a", "alpha", 5, 0))
    })
    await Bun.write(path.join(directory, "opencode-empty.db"), "")

    expect(await readUsage(path.join(directory, "opencode.db"))).toMatchObject([{ model: "alpha", msgs: 2, input: 11 }])
  }))

test("names the folder when no database holds messages", () =>
  withDirectory(async (directory) => {
    await expect(readUsage(path.join(directory, "opencode.db"))).rejects.toThrow(
      `No OpenCode database with usage data found in ${directory}`,
    )
  }))
