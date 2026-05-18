import type { UserRole } from "@/types";

// ── Shared mock data used across handler tests ────────────────────────────────

export const MOCK_USER = {
  id: "user-uuid-1234",
  email: "test@example.com",
  name: "Test User",
  role: "CUSTOMER" as UserRole,
  passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$bW9ja3NhbHQ$bW9ja2hhc2g",
  avatarUrl: null as string | null,
  phone: null as string | null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

export const MOCK_ADMIN = {
  ...MOCK_USER,
  id: "admin-uuid-5678",
  email: "admin@example.com",
  role: "ADMIN" as UserRole,
};

export const MOCK_OWNER = {
  ...MOCK_USER,
  id: "owner-uuid-9999",
  email: "owner@example.com",
  role: "OWNER" as UserRole,
};

export const MOCK_SESSION = {
  id: "session-uuid-abcd",
  userId: MOCK_USER.id,
  token: "mock.refresh.token",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

export const MOCK_TOKENS = {
  accessToken: "mock.access.token",
  refreshToken: "mock.refresh.token",
};

export const MOCK_RESET_TOKEN = {
  token: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  userId: MOCK_USER.id,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

export const SERVICE_TOKEN_HEADER = {
  "x-service-token": "test-internal-service-token-minimum-32chars!!",
};
