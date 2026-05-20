import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const PUBLIC_API_URL = env.PUBLIC_API_URL || process.env.PUBLIC_API_URL || "http://localhost:3000";
  const WEB_URL = env.WEB_URL || process.env.WEB_URL || "http://localhost:4321";
  const ADMIN_URL = env.ADMIN_URL || process.env.ADMIN_URL || "http://localhost:5000";
  const NODE_ENV = env.NODE_ENV || process.env.NODE_ENV || "development";
  const INTERNAL_SERVICE_TOKEN = env.INTERNAL_SERVICE_TOKEN || process.env.INTERNAL_SERVICE_TOKEN || "";

  return {
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
    define: {
      "process.env.PUBLIC_API_URL": JSON.stringify(PUBLIC_API_URL),
      "process.env.WEB_URL": JSON.stringify(WEB_URL),
      "process.env.ADMIN_URL": JSON.stringify(ADMIN_URL),
      "process.env.NODE_ENV": JSON.stringify(NODE_ENV),
      "process.env.INTERNAL_SERVICE_TOKEN": JSON.stringify(INTERNAL_SERVICE_TOKEN),
    },
    optimizeDeps: {
      include: ["effect"],
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
  };
});
