import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: { port: 4311 },
  resolve: { tsconfigPaths: true },
  plugins: [
    // Runs the SSR environment inside workerd, so dev, preview and production
    // all see the same D1 binding.
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    // tanstackStart must come before the React plugin.
    tanstackStart(),
    viteReact(),
  ],
});
