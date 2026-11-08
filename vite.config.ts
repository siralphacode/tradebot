import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// TradeNews frontend - static build served by Cloudflare.
// Production site: https://tradenews.live
// API: same-origin /api (Worker proxy) or VITE_TRADENEWS_API_BASE.
// No Google Cloud Run / Firebase / reCAPTCHA / Gemini dependencies.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // Local dev convenience: proxy /api to the Cloudflare backend.
        '/api': {
          target: process.env.VITE_TRADENEWS_API_BASE || 'https://api.tradenews.live',
          changeOrigin: true,
        },
      },
    },
  };
});
