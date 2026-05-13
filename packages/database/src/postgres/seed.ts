/**
 * Seed script — creates a default ADMIN user for local development.
 *
 * Usage:
 *   pnpm --filter @repo/database db:seed
 *
 * Default credentials (change immediately after first login):
 *   Email:    admin@example.com
 *   Password: Admin1234!
 */
import { db }   from "./client"
import * as schema from "./schema"
import { eq }   from "drizzle-orm"

// ── Password hashing (mirrors auth-service/src/lib/password.ts) ──────────────
// Uses native WebCrypto so no extra dependency is needed.

async function hashPassword(plain: string): Promise<string> {
  const salt  = crypto.getRandomValues(new Uint8Array(16))
  const base  = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plain),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  )
  const key   = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    true,
    ["sign"]
  )
  const hash  = new Uint8Array(await crypto.subtle.exportKey("raw", key))
  const hex   = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, "0")).join("")
  return `${hex(salt)}:${hex(hash)}`
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? "admin@example.com"
const ADMIN_NAME     = process.env.SEED_ADMIN_NAME     ?? "Super Admin"
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin1234!"

const SAMPLE_CATEGORIES = [
  { id: crypto.randomUUID(), name: "Elektronik",  slug: "elektronik",  sortOrder: 1 },
  { id: crypto.randomUUID(), name: "Fashion",     slug: "fashion",     sortOrder: 2 },
  { id: crypto.randomUUID(), name: "Rumah Tangga", slug: "rumah-tangga", sortOrder: 3 },
]

// ── Runner ────────────────────────────────────────────────────────────────────

async function seed() {
  console.info("🌱 Starting seed...")

  // Admin user
  const existing = await db.select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, ADMIN_EMAIL))
    .limit(1)

  if (existing.length > 0) {
    console.info(`⏭  Admin user already exists (${ADMIN_EMAIL}), skipping.`)
  } else {
    const passwordHash = await hashPassword(ADMIN_PASSWORD)
    await db.insert(schema.users).values({
      id:           crypto.randomUUID(),
      email:        ADMIN_EMAIL,
      name:         ADMIN_NAME,
      passwordHash,
      role:         "ADMIN",
    })
    console.info(`✅ Admin user created: ${ADMIN_EMAIL}`)
    console.info(`   Password:           ${ADMIN_PASSWORD}`)
    console.info(`   ⚠  Change this password after first login!`)
  }

  // Sample categories (skip if any exist)
  const existingCats = await db.select({ id: schema.categories.id })
    .from(schema.categories)
    .limit(1)

  if (existingCats.length > 0) {
    console.info("⏭  Categories already exist, skipping.")
  } else {
    await db.insert(schema.categories).values(
      SAMPLE_CATEGORIES.map(c => ({
        ...c,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    )
    console.info(`✅ Inserted ${SAMPLE_CATEGORIES.length} sample categories.`)
  }

  console.info("🌱 Seed complete.")
  process.exit(0)
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
