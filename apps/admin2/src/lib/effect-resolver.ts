import { ParseResult, Schema } from "effect"
import type { Resolver } from "react-hook-form"

/**
 * React Hook Form resolver backed by Effect Schema.
 *
 * - On success  → `{ values: decoded, errors: {} }`
 * - On failure  → `{ values: {}, errors: { "field.path": { type, message } } }`
 *
 * Uses `{ errors: "all" }` so every failing field is reported in a single
 * pass — the user sees all inline errors at once rather than one at a time.
 *
 * The resolver is type-safe: `useForm<Schema.Schema.Type<S>>` is inferred
 * automatically when you pass the schema to the resolver factory.
 */
export function effectResolver<S extends Schema.Schema<any, any, never>>(
  schema: S,
): Resolver<Schema.Schema.Type<S>> {
  return async (values) => {
    const result = Schema.decodeUnknownEither(schema, { errors: "all" })(values)

    if (result._tag === "Right") {
      return { values: result.right, errors: {} }
    }

    const issues = ParseResult.ArrayFormatter.formatErrorSync(result.left)
    const errors: Record<string, { type: string; message: string }> = {}

    for (const issue of issues) {
      // path is ReadonlyArray<PropertyKey> — join with "." for nested fields
      const key =
        issue.path.length > 0
          ? issue.path.map(String).join(".")
          : "root"

      // Keep only the first error per field so the UI stays clean
      if (!errors[key]) {
        errors[key] = { type: "validation", message: issue.message }
      }
    }

    return { values: {}, errors }
  }
}
