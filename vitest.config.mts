import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Two projects, split by what the tests actually need.
 *
 * Almost everything here is pure logic — theory, generators, the learning
 * engine, the stores — and needs no DOM. Giving every file a jsdom instance
 * cost about two thirds of the run time and, once the suite passed twenty
 * files, started exhausting worker memory on Windows (`0xC00000FD`, stack
 * overflow, in whichever file happened to start last). So jsdom is now opt-in:
 * only the component tests get it, and they are the only ones that load
 * `vitest.setup.ts` with Testing Library's cleanup.
 */
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: {
          // Picks up the "@/*" alias from tsconfig.json.
          tsconfigPaths: true,
        },
        test: {
          name: 'logic',
          globals: true,
          environment: 'node',
          include: ['src/**/*.{test,spec}.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: 'components',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.{test,spec}.tsx'],
          css: false,
        },
      },
    ],
  },
});
