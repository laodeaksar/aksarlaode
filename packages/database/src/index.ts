export { db } from "./postgres/client"
export * as schema from "./postgres/schema"
export { connectMongo } from "./mongodb/client"

// Re-export Drizzle helpers consumers commonly need
export {
  eq,
  and,
  or,
  gte,
  lte,
  ilike,
  sql,
  asc,
  desc,
  inArray,
} from "drizzle-orm"
