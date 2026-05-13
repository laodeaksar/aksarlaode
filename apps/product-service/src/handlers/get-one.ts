import { Effect } from "effect"
import type { Context } from "hono"
import { productRepository } from "@/repository/product.repository"
import type { AppEnv } from "@/types"

export const getOneHandler = async (c: Context<AppEnv>) => {
  const idOrSlug = c.req.param("id")

  const result = await Effect.runPromiseExit(productRepository.findByIdOrSlug(idOrSlug))

  if (result._tag === "Failure") {
    return c.json({ error: "Product not found" }, 404)
  }

  return c.json(result.value)
}
