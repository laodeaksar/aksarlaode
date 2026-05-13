import { Effect } from "effect"
import type { Context } from "hono"
import { productRepository } from "@/repository/product.repository"
import type { AppEnv } from "@/types"

export const createHandler = async (c: Context<AppEnv>) => {
  const body = await c.req.json()

  const result = await Effect.runPromiseExit(productRepository.create(body))

  if (result._tag === "Failure") {
    return c.json({ error: "Failed to create product" }, 500)
  }

  return c.json(result.value, 201)
}
