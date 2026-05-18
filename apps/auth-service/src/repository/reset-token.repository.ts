import { Data, Effect } from "effect";

import { eq } from "drizzle-orm";

import { db, schema } from "@repo/database";

class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

const create = (data: { token: string; userId: string; expiresAt: Date }) =>
  Effect.tryPromise({
    try: () =>
      db
        .insert(schema.passwordResetTokens)
        .values(data)
        .returning()
        .then((r) => r[0]!),
    catch: (e) => new DbError({ cause: e }),
  });

const findByToken = (token: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.token, token))
        .limit(1)
        .then((r) => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  });

const deleteByToken = (token: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.token, token)),
    catch: (e) => new DbError({ cause: e }),
  });

const deleteAllByUserId = (userId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.userId, userId)),
    catch: (e) => new DbError({ cause: e }),
  });

export const resetTokenRepository = {
  create,
  findByToken,
  deleteByToken,
  deleteAllByUserId,
};
