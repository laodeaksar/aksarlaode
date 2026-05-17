import { Data, Effect } from "effect"

import { env } from "@repo/env/order"

class ProductClientError extends Data.TaggedError("ProductClientError")<{
  status: number
}> {}
class InsufficientStockError extends Data.TaggedError(
  "InsufficientStockError"
)<{ productId: string }> {}
class ProductNotFoundError extends Data.TaggedError("ProductNotFoundError")<{
  productId: string
}> {}

export type ProductSnapshot = {
  productId: string
  productName: string
  sku: string
  price: number
  imageUrl?: string
}

const headers = () => ({
  "Content-Type": "application/json",
  "x-service-token": env.INTERNAL_SERVICE_TOKEN,
})

export const productClient = {
  /**
   * Fetch authoritative product data (name, sku, price) from product-service.
   * Used in order creation to prevent client-side price manipulation.
   */
  getProduct: (productId: string) =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(
          `${env.PRODUCT_SERVICE_URL}/products/${productId}`,
          { method: "GET", headers: headers() }
        )
        if (res.status === 404)
          throw { _tag: "ProductNotFoundError", productId }
        if (!res.ok) throw { _tag: "ProductClientError", status: res.status }
        return res.json() as Promise<ProductSnapshot>
      },
      catch: (e: any) => {
        if (e._tag === "ProductNotFoundError")
          return new ProductNotFoundError({ productId: e.productId })
        return new ProductClientError({ status: e.status ?? 500 })
      },
    }),

  reserveStock: (productId: string, quantity: number) =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(
          `${env.PRODUCT_SERVICE_URL}/products/${productId}/stock/reserve`,
          {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ quantity }),
          }
        )
        if (res.status === 404)
          throw { _tag: "ProductNotFoundError", productId }
        if (res.status === 409)
          throw { _tag: "InsufficientStockError", productId }
        if (!res.ok) throw { _tag: "ProductClientError", status: res.status }
      },
      catch: (e: any) => {
        if (e._tag === "ProductNotFoundError")
          return new ProductNotFoundError({ productId: e.productId })
        if (e._tag === "InsufficientStockError")
          return new InsufficientStockError({ productId: e.productId })
        return new ProductClientError({ status: e.status ?? 500 })
      },
    }),

  releaseStock: (productId: string, quantity: number) =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(
          `${env.PRODUCT_SERVICE_URL}/products/${productId}/stock/release`,
          {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ quantity }),
          }
        )
        if (!res.ok) throw { status: res.status }
      },
      catch: (e: any) => new ProductClientError({ status: e.status ?? 500 }),
    }),
}
