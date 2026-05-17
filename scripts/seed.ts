import { db, schema } from "@repo/database"
import { connectMongo } from "@repo/database/mongodb"

async function seed() {
  console.log("🌱 Seeding database...")

  // ── Admin user ─────────────────────────────────────────
  await db
    .insert(schema.users)
    .values({
      id: crypto.randomUUID(),
      email: "admin@myecommerce.com",
      name: "Admin",
      passwordHash: "REPLACE_WITH_HASHED_PASSWORD",
      role: "ADMIN",
    })
    .onConflictDoNothing()

  // ── Categories ─────────────────────────────────────────
  const [electronics] = await db
    .insert(schema.categories)
    .values([
      {
        id: crypto.randomUUID(),
        name: "Electronics",
        slug: "electronics",
        sortOrder: 1,
      },
      {
        id: crypto.randomUUID(),
        name: "Fashion",
        slug: "fashion",
        sortOrder: 2,
      },
      { id: crypto.randomUUID(), name: "Books", slug: "books", sortOrder: 3 },
    ])
    .returning()
    .onConflictDoNothing()

  // ── Products ───────────────────────────────────────────
  await db
    .insert(schema.products)
    .values([
      {
        id: crypto.randomUUID(),
        name: "Wireless Earbuds Pro",
        slug: "wireless-earbuds-pro",
        sku: "WEP-001",
        price: 299_000,
        comparePrice: 399_000,
        stock: 50,
        status: "ACTIVE",
        categoryId: electronics?.id,
        imageUrls: ["https://picsum.photos/seed/earbuds/400/400"],
        description: "Premium wireless earbuds with active noise cancellation.",
      },
      {
        id: crypto.randomUUID(),
        name: "Mechanical Keyboard TKL",
        slug: "mechanical-keyboard-tkl",
        sku: "MKT-001",
        price: 750_000,
        stock: 25,
        status: "ACTIVE",
        categoryId: electronics?.id,
        imageUrls: ["https://picsum.photos/seed/keyboard/400/400"],
        description: "Tenkeyless mechanical keyboard with RGB backlight.",
      },
    ])
    .onConflictDoNothing()

  console.log("✅ Seed complete!")
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
