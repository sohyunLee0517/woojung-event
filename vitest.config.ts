import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test-setup.ts"],
    // 실제 DB(Neon, 미국 동부) 테스트는 왕복이 느려서 넉넉하게
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
