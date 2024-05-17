import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import external_packages from './build/external_packages.json'

//console.log(import.meta.env)
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [vue()],
      build: {
      lib: {
        entry: [
          resolve(__dirname, 'build/index.js'),
        ],
          name: 'PVTables'
      },
      rollupOptions: {
        external: ['vue', 'primevue', 'axios', ...external_packages],
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
        [env.VITE_API_BASE_URL]: {
          target: `${env.VITE_API_BASE_URL}`,
          changeOrigin: true,
          // rewrite: (path) => path.replace(/^\/api/, ''),
        }
      }
    }
  }
})
