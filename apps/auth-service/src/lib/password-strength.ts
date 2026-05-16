// Top common passwords that pass an 8-char minimum but are trivially guessable.
// Kept intentionally small to avoid maintenance burden — the goal is catching
// the worst offenders, not replacing a full entropy scorer.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password!", "p@ssword", "p@ssw0rd",
  "12345678", "123456789", "1234567890", "00000000", "11111111",
  "qwerty123", "qwertyui", "abcdefgh", "abcd1234", "abc12345",
  "iloveyou", "sunshine", "princess", "monkey12", "dragon12",
  "letmein1", "welcome1", "baseball", "football", "mustang1",
  "master12", "superman", "batman12", "starwars", "michael1",
  "shadow12", "123qwerty", "pass1234", "test1234", "admin123",
  "login123", "changeme", "trustno1", "hello123", "welcome!",
])

/**
 * Returns an error message string if the password is in the common-password
 * denylist, otherwise returns null (password is acceptable).
 * Comparison is case-insensitive. Call BEFORE hashing.
 */
export function checkPasswordStrength(password: string): string | null {
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Password is too common. Please choose a less predictable password."
  }
  return null
}
