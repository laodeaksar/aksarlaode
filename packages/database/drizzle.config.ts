import type { Config } from "drizzle-kit";

export default {
  schema: "./src/postgres/schema/index.ts",
  out: "./src/postgres/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
