import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import vitePluginSingleSpa from 'vite-plugin-single-spa';


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // GEMINI_API_KEY es opcional - si no está configurada, usar string vacío
  const geminiApiKey = env.GEMINI_API_KEY || env.API_KEY || '';

  // Detectar si estamos en Vercel o modo standalone
  const isStandalone = !!process.env.VERCEL || mode === 'standalone';

  const baseConfig = {
    server: {
      port: 4203,
      host: '0.0.0.0',
      cors: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [
      react(),
      // Solo habilitar plugin Single-SPA si NO estamos en modo standalone
      !isStandalone && vitePluginSingleSpa({
        type: 'mife',
        serverPort: 4203,
        spaEntryPoints: './index.tsx', // Corregido de spaEntryPoint a spaEntryPoints
      }),
    ].filter(Boolean),
    define: {
      'process.env.API_KEY': JSON.stringify(geminiApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      'process.env.VERCEL': JSON.stringify(process.env.VERCEL), // Pasar flag al cliente
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 1000,
      // Configuración condicional según el modo
      ...(isStandalone ? {
        // Build Standalone (Vercel/Producción Estándar)
        outDir: 'dist',
        rollupOptions: {
          // No externalizar nada
          output: {
            format: 'es' as const, // Estándar ES Modules
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]'
          }
        }
      } : {
        // Build Microfrontend (SystemJS)
        rollupOptions: {
          external: ['react', 'react-dom'],
          output: {
            format: 'system' as const, // SystemJS (usar 'system' que es el valor estándar de Rollup, o 'systemjs' si Vite lo requiere específico, pero 'system' es el ModuleFormat válido)
            entryFileNames: 'main.js',
            globals: {
              'react': 'React',
              'react-dom': 'ReactDOM'
            }
          }
        }
      })
    }
  };

  return baseConfig;
});

