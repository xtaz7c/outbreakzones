import { defineConfig } from 'vite';
import path from 'node:path';

const buildId = (
  process.env.GITHUB_SHA ??
  process.env.COMMIT_REF ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  'local'
).slice(0, 7);

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    open: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
