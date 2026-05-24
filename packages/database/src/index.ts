export { db } from "./postgres/client";
export * as schema from "./postgres/schema";
export { connectMongo } from "./mongodb/client";

export type {
  StoreSettings,
  StoreSettingsRow,
} from "./postgres/schema/store-settings";
export { DEFAULT_STORE_SETTINGS } from "./postgres/schema/store-settings";

// Re-export Drizzle helpers consumers commonly need
export {
  eq,
  ne,
  and,
  or,
  not,
  gte,
  gt,
  lte,
  lt,
  isNull,
  isNotNull,
  ilike,
  like,
  sql,
  asc,
  desc,
  inArray,
  notInArray,
} from "drizzle-orm";
export type { SQL } from "drizzle-orm";

export type { AdminAuditLog, NewAdminAuditLog } from "./postgres/schema/admin-audit-log";
