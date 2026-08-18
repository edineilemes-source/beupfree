import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

function partnerVerificationMeta() {
  return {
    name: "partner-verification-meta",
    transformIndexHtml() {
      const token = process.env.AWIN_VERIFICATION_TOKEN?.trim();
      if (!token) return [];
      return [{
        tag: "meta",
        attrs: { name: "awin-verification", content: token },
        injectTo: "head" as const,
      }];
    },
  };
}

export default defineConfig({
  define: {
    "import.meta.env.PUBLIC_DEMO_MODE": JSON.stringify(
      process.env.PUBLIC_DEMO_MODE === "true" ? "true" : "false",
    ),
    "import.meta.env.PUBLIC_CONTACT_EMAIL": JSON.stringify(
      process.env.PUBLIC_CONTACT_EMAIL ?? "",
    ),
  },
  plugins: [
    react(),
    partnerVerificationMeta(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
