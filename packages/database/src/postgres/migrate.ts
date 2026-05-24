import path from "path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db } from "./client";

async function runMigrations() {
  console.info("Running migrations...");
  await migrate(db, {
    migrationsFolder: path.join(__dirname, "./migrations"),
  });
  console.info("Migrations complete.");
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
