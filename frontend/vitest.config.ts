import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      include: ['features/**', 'components/shared/**', 'hooks/**'],
      exclude: ['**/*.test.*', '**/*.spec.*', 'node_modules', '.next'],
      thresholds: {
        lines: 70,
        branches: 60,
      },
      reporter: ['text', 'lcov'],
    },
  },
})
