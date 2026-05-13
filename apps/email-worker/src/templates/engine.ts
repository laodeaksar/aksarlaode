// Minimal, zero-dependency template engine
// Replaces {{ variable }} tokens with payload values

export function render(
  template: string,
  data:     Record<string, string | number | undefined>
): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    const value = data[key]
    return value !== undefined ? String(value) : ""
  })
}
