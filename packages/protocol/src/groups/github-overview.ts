import { GithubOverview } from "@opencode-ai/schema/github-overview"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Location } from "@opencode-ai/schema/location"
import { LocationQuery, locationQueryOpenApi } from "./location"

export const GithubOverviewGroup = HttpApiGroup.make("server.github-overview")
  .add(
    HttpApiEndpoint.get("github-overview.get", "/api/github-overview", {
      query: LocationQuery,
      success: Location.response(GithubOverview.Overview),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.github-overview.get",
          summary: "Get GitHub overview",
          description: "Local worktree status plus GitHub commits, checks, dependencies, issues, and pull requests for one repository.",
        }),
      ),
  )
  .annotateMerge(OpenApi.annotations({ title: "github-overview", description: "Single-repository GitHub overview." }))
