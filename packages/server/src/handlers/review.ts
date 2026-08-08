import { Review } from "@opencode-ai/core/review"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { ReviewMutationError } from "@opencode-ai/protocol/groups/review"
import { Api } from "../api"
import { response } from "../location"

export const ReviewHandler = HttpApiBuilder.group(Api, "server.review", (handlers) =>
  handlers
    .handle("review.capture", () =>
      response(Review.Service.use((review) => review.capture()).pipe(Effect.mapError(error))),
    )
    .handle("review.mutate", (ctx) =>
      response(
        Review.Service.use((review) => review.mutate({ ...ctx.params, ...ctx.payload })).pipe(Effect.mapError(error)),
      ),
    ),
)

function error(cause: unknown) {
  if (cause instanceof Review.RevisionNotFoundError)
    return new ReviewMutationError({
      name: "ReviewMutationError",
      data: { reason: "not-found", message: "The review revision is no longer available" },
    })
  if (cause instanceof Review.RepositoryNotFoundError)
    return new ReviewMutationError({
      name: "ReviewMutationError",
      data: { reason: "non-git", message: "The selected location is not a Git repository" },
    })
  if (cause instanceof Review.ConflictError)
    return new ReviewMutationError({
      name: "ReviewMutationError",
      data: { reason: cause.reason, message: cause.message },
    })
  return new ReviewMutationError({
    name: "ReviewMutationError",
    data: { reason: "overlap", message: "The review change could not be applied" },
  })
}
