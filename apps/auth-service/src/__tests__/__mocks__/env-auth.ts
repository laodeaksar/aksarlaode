export const env = {
  NODE_ENV:               "test" as const,
  DATABASE_URL:           "postgresql://localhost:5432/test",
  JWT_SECRET:             "test-jwt-secret-that-is-at-least-32-characters-long",
  INTERNAL_SERVICE_TOKEN: "test-internal-service-token-minimum-32chars!!",
  WEB_URL:                "http://localhost:3000",
  ADMIN_URL:              "http://localhost:3001",
}
