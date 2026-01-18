import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    global: 'window',
  },

  // Build optimization
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,

    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React vendor chunk
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }

          // React Query vendor chunk
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }

          // Radix UI vendor chunk
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }

          // Framer Motion vendor chunk
          if (id.includes('framer-motion')) {
            return 'animation-vendor';
          }

          // Zustand vendor chunk
          if (id.includes('zustand')) {
            return 'state-vendor';
          }
        },
      },
    },
  },

  // Development server
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    open: false,
  },

  // Preview server
  preview: {
    port: 4173,
    strictPort: false,
    host: true,
    open: false,
  },
});
