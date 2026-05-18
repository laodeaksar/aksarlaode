/** @type {import('prettier').Config} */
module.exports = {
  endOfLine: "lf",
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 80,
  importOrder: [
    // 1. React core + react-*
    "^(react/(.*)$)|^(react$)",
    "^(react-(.*)$)",
    "",
    // 2. TanStack ecosystem (router, query, table, start)
    "^@tanstack/(.*)$",
    "",
    // 3. Effect ecosystem
    "^effect(.*)$",
    "",
    // 4. Other third-party (react-hook-form, lucide-react, zod, etc.)
    "<THIRD_PARTY_MODULES>",
    "",
    // 5. Workspace packages (@repo/*)
    "^@repo/(.*)$",
    "",
    // 6. App-internal absolute imports — ordered by architectural layer
    "^@/server/(.*)$",
    "^@/effect/(.*)$",
    "^@/lib/(.*)$",
    "^@/hooks/(.*)$",
    "^@/schemas/(.*)$",
    "^@/types/(.*)$",
    "^@/config/(.*)$",
    "^@/components/ui/(.*)$",
    "^@/components/(.*)$",
    "^@/(.*)$",
    "",
    // 7. Relative imports (./Route self-reference goes here last)
    "^[./]",
    "",
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
  ],
  tailwindStylesheet: "./packages/ui/src/styles/globals.css",
  tailwindFunctions: ["cn", "cva"],
}
