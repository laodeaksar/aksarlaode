export const env = {
  NODE_ENV:               "test" as const,
  DATABASE_URL:           "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET:      "test-jwt-access-secret-that-is-at-least-32-chars",
  JWT_REFRESH_SECRET:     "test-jwt-refresh-secret-that-is-at-least-32-chars",
  INTERNAL_SERVICE_TOKEN: "test-internal-service-token-minimum-32chars!!",
  REDIS_HOST:             "localhost",
  REDIS_PORT:             6379,
  REDIS_PASSWORD:         "",
  WEB_URL:                "http://localhost:3000",
  ADMIN_URL:              "http://localhost:3001",
}
