import { Data } from "effect"

// ── Typed Error Model ──────────────────────────────────────────────────────
// All errors are tagged so exhaustive matching is possible at every call site.
// No `unknown` or `any` leaks to the client — each variant is serializable.

export class ApiError extends Data.TaggedError("ApiError")<{
  readonly status:  number
  readonly message: string
  readonly path:    string
}> {
  get userMessage(): string {
    switch (this.status) {
      case 400: return "Request tidak valid."
      case 401: return "Sesi habis. Silakan login kembali."
      case 403: return "Anda tidak memiliki akses ke resource ini."
      case 404: return "Data tidak ditemukan."
      case 409: return "Konflik data. Silakan refresh dan coba lagi."
      case 422: return "Data yang dikirim tidak valid."
      case 429: return "Terlalu banyak permintaan. Coba lagi sebentar."
      default:  return this.status >= 500
        ? "Terjadi kesalahan server. Tim kami sudah diberitahu."
        : this.message
    }
  }
}

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly cause:   unknown
  readonly path:    string
}> {
  get userMessage(): string {
    return "Gagal terhubung ke server. Periksa koneksi internet Anda."
  }
}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field?:  string
  readonly message: string
  readonly input:   unknown
}> {
  get userMessage(): string {
    return this.field
      ? `Field "${this.field}": ${this.message}`
      : this.message
  }
}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string
  readonly id:       string
}> {
  get userMessage(): string {
    return `${this.resource} dengan ID "${this.id}" tidak ditemukan.`
  }
}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly reason: string
}> {
  get userMessage(): string {
    return "Sesi Anda tidak valid. Silakan login kembali."
  }
}

// ── Union type for exhaustive matching ────────────────────────────────────
export type AppError =
  | ApiError
  | NetworkError
  | ValidationError
  | NotFoundError
  | UnauthorizedError

// ── Serializable form safe to send to the client ──────────────────────────
export type SerializedError = {
  readonly _tag:        AppError["_tag"]
  readonly userMessage: string
}

export function serializeError(err: AppError): SerializedError {
  return {
    _tag:        err._tag,
    userMessage: err.userMessage,
  }
}
