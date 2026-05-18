/**
 * One-way SHA-256 hash for opaque tokens (refresh tokens, reset tokens).
 *
 * The raw token is sent to the client (cookie / email link) and NEVER stored.
 * Only the hex digest is persisted in the database so that a DB dump cannot
 * be used directly to hijack sessions or reset passwords.
 *
 * SHA-256 is appropriate here because the tokens are already high-entropy
 * (256-bit CSPRNG values) — no salt or stretching is required.
 */
export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
