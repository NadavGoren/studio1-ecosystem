import { defineConfig } from 'vitest/config'

// Geometry tests are pure (no DOM), so the lightweight node environment is fine.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
