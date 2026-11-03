import { GithubOverview } from "@opencode/core/github-overview"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"
import { response } from "../location"

export const GithubHandler = HttpApiBuilder.group(Api, "server.github", (handlers) =>
  handlers.handle(
    "github.overview",
    Effect.fn("server.github.overview")(function* () {
      const github = yield* GithubOverview.Service
      return yield* response(github.overview())
    }),
  ),
)
