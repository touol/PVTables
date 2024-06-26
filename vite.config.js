import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import external_packages from './build/external_packages.json'
import libraries from './build/libraries.js'


// console.log(resolve(__dirname, './pvtables/pvtables.vue'))
// https://vitejs.dev/config/
let aliases = {}
for(let key in libraries){
  aliases['pvtables/' + key] = libraries[key].path
  external_packages.push('pvtables/' + key)
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [vue()],
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
    resolve: {
      alias: aliases
    }
  }
})
