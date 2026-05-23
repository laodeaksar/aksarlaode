/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*/lib/toast"],
              message:
                'Import toast from "@/lib" instead of "@/lib/toast" directly.',
            },
            {
              group: ["*/lib/query-keys"],
              message:
                'Import queryKeys from "@/lib" instead of "@/lib/query-keys" directly.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".tanstack/**",
      "src/routeTree.gen.ts",
    ],
  },
];
