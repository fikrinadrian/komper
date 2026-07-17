import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const server = fileURLToPath(new URL('./src/server', import.meta.url));
const shared = fileURLToPath(new URL('./src/shared', import.meta.url));
const client = fileURLToPath(new URL('./src/client', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@server\/(.*)\.js$/, replacement: `${server}/$1` },
      { find: /^@shared\/(.*)\.js$/, replacement: `${shared}/$1` },
      { find: /^@client\/(.*)\.js$/, replacement: `${client}/$1` },
      { find: '@server', replacement: server },
      { find: '@shared', replacement: shared },
      { find: '@client', replacement: client },
    ],
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});
