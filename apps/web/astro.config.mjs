import { defineConfig } from "astro/config"
import react            from "@astrojs/react"
import tailwindcss         from "@tailwindcss/vite"

export default defineConfig({
  integrations: [react()],
  output: "server",
  server: {
    host: "0.0.0.0",
    port: 4321,
    allowedHosts: true,
  },
  vite: {
    server: {
      allowedHosts: true,
    },
    plugins: [tailwindcss()],
  },
})
