import { defineConfig } from "vitest/config";

/**
 * Tests unitaires (tests/unit) et d'intégration (tests/integration).
 * Les tests d'intégration utilisent une vraie base MariaDB de test, décrite dans .env.test :
 * les fichiers sont exécutés l'un après l'autre car ils partagent cette base.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": new URL("./tests/support/empty.ts", import.meta.url).pathname },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/support/global-setup.ts"],
    setupFiles: ["tests/support/load-test-env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
