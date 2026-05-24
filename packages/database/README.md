# `@repo/database`

Shared database layer for the monorepo. Exposes two sub-paths:

| Import path | What it provides |
|-------------|-----------------|
| `@repo/database` | Drizzle + PostgreSQL client, schema, helpers |
| `@repo/database/mongodb` | Mongoose connection + shared Mongoose models |

---

## PostgreSQL (Drizzle)

```ts
import { db, schema, eq } from "@repo/database";

const settings = await db
  .select()
  .from(schema.storeSettings)
  .where(eq(schema.storeSettings.id, 1));
```

### CLI commands

```bash
pnpm --filter @repo/database db:generate   # generate Drizzle migration files
pnpm --filter @repo/database db:migrate    # apply migrations
pnpm --filter @repo/database db:studio     # launch Drizzle Studio
pnpm --filter @repo/database db:seed       # seed reference data
```

---

## MongoDB (Mongoose)

### Connecting

```ts
import { connectMongo } from "@repo/database/mongodb";

await connectMongo(); // idempotent — safe to call multiple times
```

### Order model

The canonical Order Mongoose model. Import it in any service that reads or
writes orders — do **not** redefine the schema locally.

```ts
import {
  OrderModel,
  type OrderDocument,
  type OrderStatus,
  type LineItem,
  type Address,
  type StatusEvent,
} from "@repo/database/mongodb";

// Find a single order
const doc = await OrderModel.findOne({ orderId: "ORD-20240513-A3F9B2C1" }).lean();

// Type-safe access — includes Mongoose timestamps and domain timestamps
const createdAt: Date | undefined = doc?.createdAt;
const paidAt: Date | undefined = doc?.paidAt;
```

#### `OrderDocument` fields

| Field | Type | Notes |
|-------|------|-------|
| `orderId` | `string` | Unique human-readable ID (`ORD-YYYYMMDD-XXXXXXXX`) |
| `userId` | `string` | Owner UUID |
| `status` | `OrderStatus` | See state machine below |
| `items` | `LineItem[]` | Price snapshot at order creation |
| `shippingAddress` | `Address` | Recipient details |
| `statusHistory` | `StatusEvent[]` | Append-only audit log |
| `totalAmount` | `number` | Sum of line item subtotals |
| `shippingFee` | `number` | Carrier charge |
| `discountAmount` | `number` | Voucher / promo deduction |
| `grandTotal` | `number` | `totalAmount + shippingFee - discountAmount` |
| `notes` | `string?` | Free-text customer note |
| `createdAt` | `Date?` | Mongoose `timestamps: true` |
| `updatedAt` | `Date?` | Mongoose `timestamps: true` |
| `paidAt` | `Date?` | Set when status → `PAID` |
| `shippedAt` | `Date?` | Set when status → `SHIPPED` |
| `deliveredAt` | `Date?` | Set when status → `DELIVERED` |
| `cancelledAt` | `Date?` | Set when status → `CANCELLED` |

#### `OrderStatus` union

```ts
type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"   // terminal
  | "REFUNDED";   // terminal
```

#### Indexes

| Index | Purpose |
|-------|---------|
| `orderId` (unique) | Primary lookup key |
| `userId` | Per-user order list |
| `{ userId, createdAt: -1 }` | Paginated user order history |
| `{ status, createdAt: -1 }` | Admin filtered listing |
| `{ status: PENDING_PAYMENT, createdAt }` (partial) | Reconciliation sweep |
| `paidAt` (sparse) | Revenue reporting by payment date |

---

## Adding a new Mongoose model

1. Create `src/mongodb/models/<name>.model.ts` (schema + types + `model()` call).
2. Re-export it from `src/mongodb/models/index.ts`.
3. The `src/mongodb/index.ts` barrel picks it up automatically via the models barrel.
4. Document the new model in this README under a new section.
