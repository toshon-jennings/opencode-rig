import { GithubOverview } from "@opencode/schema/github-overview"
import { Location } from "@opencode/schema/location"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"
import { LocationQuery, locationQueryOpenApi } from "./location.js"

export const GithubGroup = HttpApiGroup.make("server.github")
  .add(
    HttpApiEndpoint.get("github.overview", "/api/github/overview", {
      query: LocationQuery,
      success: Location.response(GithubOverview.Overview),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "github.overview",
          summary: "Get GitHub overview",
          description:
            "Local worktree status plus GitHub commits, checks, dependencies, issues, and pull requests for the location's repository. Uses GITHUB_TOKEN, GH_TOKEN or the gh login on the server's machine.",
        }),
      ),
  )
  .annotateMerge(OpenApi.annotations({ title: "github", description: "Single-repository GitHub overview." }))
