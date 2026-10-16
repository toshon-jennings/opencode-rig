import { GithubOverview } from "@opencode-ai/core/github-overview"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { response } from "../location"

export const GithubOverviewHandler = HttpApiBuilder.group(Api, "server.github-overview", (handlers) =>
  handlers.handle("github-overview.get", () =>
    response(GithubOverview.Service.use((overview) => overview.overview())),
  ),
)
