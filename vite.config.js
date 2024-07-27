import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from 'tailwindcss'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    build: {
      outDir: "./dist",
      lib: {
        entry:'./src/index.js',
        formats: ["es", "cjs"],
      },
      emptyOutDir: true,
      rollupOptions: {
        external: ['vue'],
        output: {
            globals: {
                vue: 'Vue'
            }
        }
      }
    },
    plugins: [vue(),tailwindcss()],
    server: {
      // dev api access
      // proxy: {
      //   [env.VITE_API_BASE_URL + 'api/']: {
      //     target: `${env.VITE_API_BASE_URL}api/`,
      //     changeOrigin: true,
      //     // rewrite: (path) => path.replace(/^\/api/, ''),
      //   }
      // }
    },
      // resolve: {
      //   alias: aliases
      // }
  }
})
