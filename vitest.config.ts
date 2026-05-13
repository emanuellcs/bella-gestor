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
  },
});
