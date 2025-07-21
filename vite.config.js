import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from 'tailwindcss'

export default defineConfig(({ mode }) => {
  // process.env = {...process.env,...loadEnv(mode, './'),...loadEnv(mode, '../')}
  return {
    // define: {
    //   'import.meta': 'import.meta'
    // },
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
    plugins: [vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => false
        }
      }
    }),tailwindcss()],
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false
    },
    resolve: {
      alias: {
        'vue': 'vue/dist/vue.esm-bundler.js'
      }
    },
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
