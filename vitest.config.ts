import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['server/tsconfig.json'] })],
  test: {
    include: ['server/mcp/__tests__/**/*.test.ts'],
    setupFiles: ['reflect-metadata'],
    coverage: {
      include: ['server/mcp/**/*.ts'],
      exclude: ['server/mcp/__tests__/**', 'server/mcp/stdio.ts'],
    },
  },
});
