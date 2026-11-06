import { defineConfig } from 'vite';

const sogProxy = {
  '/sog-assets': {
    target: 'https://pub-dd92ae5131ec49f1bbd411b51a858249.r2.dev',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/sog-assets/, ''),
  },
};

export default defineConfig({
  server: { proxy: sogProxy },
  preview: { proxy: sogProxy },
});
