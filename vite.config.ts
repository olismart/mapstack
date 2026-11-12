import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { komootImportMiddleware } from './server/komootImport';

function komootImport(): Plugin {
  return {
    name: 'mapstack-komoot-import',
    configureServer(server) {
      server.middlewares.use(komootImportMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(komootImportMiddleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), basicSsl(), komootImport()],
  server: {
    port: 5173,
    host: true,
  },
});

