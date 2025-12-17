import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // GEMINI_API_KEY es opcional - si no está configurada, usar string vacío
  const geminiApiKey = env.GEMINI_API_KEY || env.API_KEY || '';

  return {
    server: {
      port: 4203,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(geminiApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 1000
    }
  };
});

