import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.ts', 'src/pages/api/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types.ts']
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@db': '/db'
    }
  }
});
