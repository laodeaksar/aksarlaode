/**
 * Integration-test env for the database package.
 *
 * Reads DATABASE_URL from the real process.env so Drizzle connects to the
 * dev Postgres instance (tables created by the globalSetup migration run).
 */
export const env = {
  NODE_ENV: "test" as const,
  DATABASE_URL:
    process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/ecommerce",
  MONGODB_URL: "mongodb://localhost:27017/test",
}
