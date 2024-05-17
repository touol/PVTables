import { build } from "vite";
import libraries from './libraries.js'
import external_packages from './external_packages.json' assert { type: "json" };


let libraries0 = []
for(let key in libraries){
    libraries0.push({
        entry: libraries[key].entry?libraries[key].entry:libraries[key].path,
        fileName: key,
    })
    external_packages.push('pvtables/' + key)
}
// console.log(libraries0)
libraries0.forEach(async (lib) => {
    await build({
        build: {
            outDir: "./" + lib.fileName,
            lib: {
                ...lib,
                formats: ["es", "cjs"],
            },
            emptyOutDir: false,
            rollupOptions: {
                external: ['vue', 'primevue', 'axios', ...external_packages],
                output: {
                    globals: {
                        vue: 'Vue'
                    }
                }
            }
        }
    });
});

