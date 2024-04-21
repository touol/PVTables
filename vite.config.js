import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import {resolve} from 'path'
import external_packages from './build/external_packages.json' 

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: [
        resolve( __dirname, 'build/index.js'),
      ],
      name: 'PVTables'
    },
    rollupOptions: {
      external: ['vue','primevue', 'axios', ...external_packages],
      output: {
        globals: {
            vue: 'Vue'
        }
      }
    }
  },
  server: {
    // dev api access
    proxy: {
      '/api': {
        target: 'https://xn-----6kcbab0cjcacpbcc1c1bdgfjoon.xn--p1ai/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
})
