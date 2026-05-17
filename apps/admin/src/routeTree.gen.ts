import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"

import { Route as rootRoute } from "./routes/__root"
import { Route as CustomerIdRoute } from "./routes/customers/$userId"
import { Route as CustomersRoute } from "./routes/customers/index"
import { Route as DashboardRoute } from "./routes/dashboard/index"
import { Route as IndexRoute } from "./routes/index"
import { Route as LoginRoute } from "./routes/login"
import { Route as OrderIdRoute } from "./routes/orders/$orderId"
import { Route as OrdersRoute } from "./routes/orders/index"
import { Route as ProductIdRoute } from "./routes/products/$productId"
import { Route as ProductsRoute } from "./routes/products/index"
import { Route as ProductsNewRoute } from "./routes/products/new"

const routeTree = rootRoute.addChildren([
  IndexRoute,
  LoginRoute,
  DashboardRoute,
  ProductsRoute,
  ProductsNewRoute,
  ProductIdRoute,
  OrdersRoute,
  OrderIdRoute,
  CustomersRoute,
  CustomerIdRoute,
])

export { routeTree }
