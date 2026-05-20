import { Effect } from "effect";

import type {
  AuditLogEntry,
  DashboardStats,
  OrderDetail,
  OrderSummary,
} from "@/types";

import { ApiError, NetworkError } from "./Errors";
import { ConfigService } from "./Services.config";
import type { NewProduct, Product, User } from "./Services.schemas";

// ── ApiClientService ───────────────────────────────────────────────────────
// A typed Effect-based HTTP client. Used ONLY in server functions.
// The browser client (src/lib/api.ts) remains for legacy client-side fetches.

export class ApiClientService extends Effect.Service<ApiClientService>()(
  "admin/ApiClientService",
  {
    effect: Effect.gen(function* () {
      const config = yield* ConfigService;

      // ── Core request helper ───────────────────────────────────────────────
      function request<T>(
        path: string,
        init: RequestInit = {}
      ): Effect.Effect<T, ApiError | NetworkError> {
        return Effect.tryPromise({
          try: async () => {
            const res = await fetch(`${config.apiUrl}${path}`, {
              ...init,
              headers: {
                "Content-Type": "application/json",
                ...(config.internalToken
                  ? { "x-service-token": config.internalToken }
                  : {}),
                ...(init.headers ?? {}),
              },
            });

            if (!res.ok) {
              const body = await res
                .json()
                .catch(() => ({ error: res.statusText }));
              throw new ApiError({
                status: res.status,
                message: (body as { error?: string }).error ?? res.statusText,
                path,
              });
            }

            return res.json() as Promise<T>;
          },
          catch: (e) =>
            e instanceof ApiError ? e : new NetworkError({ cause: e, path }),
        });
      }

      // ── Products ──────────────────────────────────────────────────────────
      const products = {
        list: (params: { page?: number; limit?: number; search?: string }) => {
          const qs = new URLSearchParams({
            page: String(params.page ?? 1),
            limit: String(params.limit ?? 20),
            ...(params.search ? { search: params.search } : {}),
          }).toString();
          return request<{ items: Product[]; total: number }>(
            `/products?${qs}`
          );
        },

        getOne: (id: string) => request<Product>(`/products/${id}`),

        create: (body: NewProduct) =>
          request<Product>("/products", {
            method: "POST",
            body: JSON.stringify(body),
          }),

        update: (id: string, body: Partial<NewProduct>) =>
          request<Product>(`/products/${id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          }),

        delete: (id: string) =>
          request<void>(`/products/${id}`, { method: "DELETE" }),
      };

      // ── Orders ────────────────────────────────────────────────────────────
      const orders = {
        list: (params: { page?: number; status?: string }) => {
          const qs = new URLSearchParams({
            page: String(params.page ?? 1),
            ...(params.status ? { status: params.status } : {}),
          }).toString();
          return request<{ items: OrderSummary[]; total: number }>(
            `/orders?${qs}`
          );
        },

        getOne: (id: string) => request<OrderDetail>(`/orders/${id}`),

        updateStatus: (id: string, status: string, note?: string) =>
          request<void>(`/orders/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status, note }),
          }),
      };

      // ── Customers ─────────────────────────────────────────────────────────
      const customers = {
        list: (params: { page?: number; search?: string }) => {
          const qs = new URLSearchParams({
            page: String(params.page ?? 1),
            ...(params.search ? { search: params.search } : {}),
          }).toString();
          return request<{ items: User[]; total: number }>(
            `/admin/users?${qs}&role=CUSTOMER`
          );
        },

        getOne: (id: string) => request<User>(`/admin/users/${id}`),

        updateRole: (id: string, role: string) =>
          request<{ user: User; changed: { from: string; to: string } }>(
            `/admin/users/${id}/role`,
            {
              method: "PATCH",
              body: JSON.stringify({ role }),
            }
          ),

        delete: (id: string) =>
          request<{ message: string; deleted: { id: string; email: string; role: string; deletedAt: string } }>(
            `/admin/users/${id}`,
            { method: "DELETE" }
          ),

        restore: (id: string) =>
          request<{ message: string; user: User }>(
            `/admin/users/${id}/restore`,
            { method: "PATCH" }
          ),
      };

      // ── Dashboard ─────────────────────────────────────────────────────────
      const dashboard = {
        stats: () => request<DashboardStats>("/admin/dashboard/stats"),
      };

      // ── Audit logs ────────────────────────────────────────────────────────
      const auditLogs = {
        list: (params: {
          page?: number;
          startDate?: string;
          endDate?: string;
          action?: string;
          actorRole?: string;
        }) => {
          const qs = new URLSearchParams({
            page: String(params.page ?? 1),
          });
          if (params.startDate) qs.set("startDate", params.startDate);
          if (params.endDate) qs.set("endDate", params.endDate);
          if (params.action) qs.set("action", params.action);
          if (params.actorRole) qs.set("actorRole", params.actorRole);
          return request<{
            items: AuditLogEntry[];
            total: number;
            page: number;
            limit: number;
          }>(`/products/audit-logs?${qs.toString()}`);
        },
      };

      return { products, orders, customers, dashboard, auditLogs } as const;
    }),
  }
) {}
