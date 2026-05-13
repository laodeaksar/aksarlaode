import { Effect } from "effect"
import type { Context } from "hono"
import { productRepository } from "../repository/product.repository"
import type { AppEnv } from "../types"

export const updateHandler = async (c: Context<AppEnv>) => {
  const id   = c.req.param("id")
  const body = await c.req.json()

  const result = await Effect.runPromiseExit(productRepository.update(id, body))

  if (result._tag === "Failure") {
    return c.json({ error: "Failed to update product" }, 500)
  }

  return c.json(result.value)
}
