import { defineConfig } from "vitest/config";

// отдельно от vite.config.ts: тестам не нужен service worker
export default defineConfig({
  test: { environment: "happy-dom", include: ["src/**/*.test.ts"] },
});
