import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import devServer from "@hono/vite-dev-server";
import path from "path";

const __dirname = import.meta.dirname;

// Single-origin dev: the Hono API and the React SPA are served from the same
// Vite dev server. The dev-server plugin mounts the Hono app for /api/* routes,
// while React (and client routing) handles everything else.
export default defineConfig({
  plugins: [
    devServer({
      entry: "api/server.ts",
      // Only hand /api/* requests to Hono; let Vite/React serve the rest.
      exclude: [/^\/(?!api\/).*/],
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@api": path.resolve(__dirname, "./api"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split heavy vendor libs into their own long-cached chunks so the
        // initial app shell loads faster and updates invalidate less.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router"],
          "data-vendor": [
            "@trpc/client",
            "@trpc/react-query",
            "@tanstack/react-query",
            "superjson",
          ],
        },
      },
    },
  },
});
