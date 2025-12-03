import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import vitePluginSingleSpa from 'vite-plugin-single-spa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // GEMINI_API_KEY es opcional - si no está configurada, usar string vacío
  const geminiApiKey = env.GEMINI_API_KEY || env.API_KEY || '';

  return {
    server: {
      port: 4203,
      host: '0.0.0.0',
      cors: true, // Importante para Single-SPA
    },
    plugins: [
      react(),
      vitePluginSingleSpa({
        type: 'mife', // microfrontend
        serverPort: 4203,
        spaEntryPoint: './index.tsx',
      }),
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
      rollupOptions: {
        external: ['react', 'react-dom'], // React se comparte desde el root-config
        output: {
          format: 'systemjs',
          entryFileNames: 'main.js',
          globals: {
            'react': 'React',
            'react-dom': 'ReactDOM'
          }
        }
      },
      chunkSizeWarningLimit: 1000
    }
  };
});

