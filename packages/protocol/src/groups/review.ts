import { Review } from "@opencode-ai/schema/review"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Location } from "@opencode-ai/schema/location"
import { LocationQuery, locationQueryOpenApi } from "./location"

export class ReviewMutationError extends Schema.ErrorClass<ReviewMutationError>("ReviewMutationError")(
  {
    name: Schema.Literal("ReviewMutationError"),
    data: Schema.Struct({
      message: Schema.String,
      reason: Schema.Literals(["stale", "overlap", "not-found", "non-git"]),
    }),
  },
  { httpApiStatus: 409 },
) {}

export const ReviewGroup = HttpApiGroup.make("server.review")
  .add(
    HttpApiEndpoint.post("review.capture", "/api/review", {
      query: LocationQuery,
      success: Location.response(Review.Revision),
      error: ReviewMutationError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.review.capture",
          summary: "Capture working tree review",
          description: "Capture server-issued file and hunk identifiers for the current working-tree diff.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("review.mutate", "/api/review/:revisionID", {
      params: { revisionID: Review.RevisionID },
      query: LocationQuery,
      payload: Review.Mutation,
      success: Location.response(Review.Revision),
      error: ReviewMutationError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.review.mutate",
          summary: "Accept or reject captured review hunks",
          description: "Apply one server-captured working-tree review decision after checking the captured revision.",
        }),
      ),
  )
  .annotateMerge(OpenApi.annotations({ title: "review", description: "Working-tree review mutations." }))
