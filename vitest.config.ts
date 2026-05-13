import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: [
        "actions/**/*.{ts,tsx}",
        "app/api/**/*.{ts,tsx}",
        "app/agenda/page.tsx",
        "lib/domain/**/*.{ts,tsx}",
        "lib/rbac.ts",
        "services/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.{test,spec}.{ts,tsx}", "services/gas-api.gs"],
    },
  },
});
