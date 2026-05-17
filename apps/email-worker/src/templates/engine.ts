// Minimal, zero-dependency template engine
// Replaces {{ variable }} tokens with payload values.
// FIX EML-04 (P2): all interpolated values are HTML-escaped to prevent
// injection from attacker-controlled order data (product names, addresses, etc.)

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function render(
  template: string,
  data: Record<string, string | number | undefined>
): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    const value = data[key]
    if (value === undefined) return ""
    return escapeHtml(String(value))
  })
}
