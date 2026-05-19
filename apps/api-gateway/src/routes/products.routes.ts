import { Hono } from "hono";

import type { AppEnv } from "@/types/context";
import { publicProductsRateLimiter } from "@/middleware/rate-limiter";
import { proxyTo } from "@/proxy/proxy";

const router = new Hono<AppEnv>();

// Public reads
// FIX PRD-06: publicProductsRateLimiter caps GET /products at 100 req/min per
// IP to prevent catalogue scraping; global rateLimiter still applies first.
router.get("/", publicProductsRateLimiter, (c) => proxyTo("PRODUCT", c)); // list + filter + search
router.get("/:id/stock", (c) => proxyTo("PRODUCT", c)); // stock check (order-service friendly)
router.get("/:id", (c) => proxyTo("PRODUCT", c)); // single product
router.get("/slug/:slug", (c) => proxyTo("PRODUCT", c));

// Internal service-to-service stock operations
router.post("/:id/stock/reserve", (c) => proxyTo("PRODUCT", c));
router.post("/:id/stock/release", (c) => proxyTo("PRODUCT", c));

// Admin writes (routeGuard enforces ADMIN role)
// C-08: PUT /:id removed — PATCH /:id is the single update verb (partial update).
// Full-replace semantics are not exposed at the gateway; product-service handles
// field defaulting internally. Document any full-replace use-case in product-service README.
router.post("/", (c) => proxyTo("PRODUCT", c));
router.patch("/:id", (c) => proxyTo("PRODUCT", c));
router.delete("/:id", (c) => proxyTo("PRODUCT", c));
router.post("/:id/images", (c) => proxyTo("PRODUCT", c));

export default router;
