import { defineConfig , loadEnv} from 'vite'
import vue from '@vitejs/plugin-vue'
import {resolve} from 'path'
import external_packages from './external_packages.json' 

export default defineConfig({
  build: {
    lib: {
      entry: [
        resolve( __dirname, 'src/index.js'),
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
  plugins:[vue()]
})