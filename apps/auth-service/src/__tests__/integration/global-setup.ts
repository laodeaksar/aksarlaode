/**
 * Vitest globalSetup for integration tests.
 *
 * Runs once before any test file is loaded (outside the Vitest sandbox, so
 * module aliases are NOT active here).  Uses a short-lived Pool + Drizzle
 * migrator to bring the dev database schema up to date before the smoke
 * tests execute.
 */
import { drizzle }  from "drizzle-orm/node-postgres"
import { migrate }  from "drizzle-orm/node-postgres/migrator"
import { Pool }     from "pg"
import path         from "path"

export async function setup() {
  const url = process.env["DATABASE_URL"]
  if (!url) throw new Error("[integration/globalSetup] DATABASE_URL is not set")

  const pool = new Pool({ connectionString: url })
  const db   = drizzle(pool)

  // Resolve from workspace root (process.cwd() = apps/auth-service when
  // vitest is invoked from the auth-service directory)
  const migrationsFolder = path.resolve(
    process.cwd(),
    "../../packages/database/drizzle/migrations",
  )

  console.info("[integration] Running migrations from", migrationsFolder)
  await migrate(db, { migrationsFolder })
  console.info("[integration] Migrations complete")

  await pool.end()
}

export async function teardown() {}
