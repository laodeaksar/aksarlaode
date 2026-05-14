import { env } from "@repo/env/auth"

export const serviceTokenMiddleware = ({
  headers,
  set,
}: {
  headers: Record<string, string | undefined>
  set:     { status?: number; headers: Record<string, string> }
}) => {
  if (headers["x-service-token"] !== env.INTERNAL_SERVICE_TOKEN) {
    set.status = 403
    return { error: "Forbidden" }
  }
}
