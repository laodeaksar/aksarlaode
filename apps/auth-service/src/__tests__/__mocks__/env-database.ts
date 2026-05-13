export const env = {
  NODE_ENV:     "test" as const,
  DATABASE_URL: "postgresql://localhost:5432/test",
  MONGODB_URL:  "mongodb://localhost:27017/test",
}
