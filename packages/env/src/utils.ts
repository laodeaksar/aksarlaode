import { z } from "zod/v4";

/**
 * Parse process.env against a Zod schema.
 * Crashes immediately with a clear, structured error message if any variable
 * is missing or invalid — no silent fallbacks.
 */
export function parseEnv<T extends z.ZodRawShape>(
  shape: T,
  serviceName: string
): z.infer<z.ZodObject<T>> {
  const result = z.object(shape).safeParse(process.env);

  if (!result.success) {
    const fields = result.error.flatten().fieldErrors;
    const lines = Object.entries(fields)
      .map(([key, errors]) => `   ${key.padEnd(30)} ${(errors as string[] | undefined)?.join(", ")}`)
      .join("\n");

    console.error(`\n❌  [${serviceName}] Invalid environment variables:\n`);
    console.error(lines);
    console.error("\n   Check your .env file against .env.example\n");
    process.exit(1);
  }

  return result.data;
}
