import { Effect } from "effect"
import type { Context } from "hono"
import { productRepository } from "../repository/product.repository"
import type { AppEnv } from "../types"

export const deleteHandler = async (c: Context<AppEnv>) => {
  const id = c.req.param("id")

  const result = await Effect.runPromiseExit(productRepository.deleteById(id))

  if (result._tag === "Failure") {
    return c.json({ error: "Failed to delete product" }, 500)
  }

  return c.json({ message: "Deleted" })
}
