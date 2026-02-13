import { defineConfig } from 'vite';

const repoName = process.env.REPO_NAME ?? 'nizam';

export default defineConfig({
  base: `/${repoName}/`,
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});