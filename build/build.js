import { build } from "vite";
import libraries from './libraries.js'
import external_packages from './external_packages.json' assert { type: "json" };
import fs from 'fs';

let libraries0 = []
let external_pvtables = []
for(let key in libraries){
    libraries0.push({
        entry: libraries[key].entry?libraries[key].entry:libraries[key].path,
        fileName: key,
    })
    external_pvtables.push('pvtables/' + key)
}
fs.writeFile('./build/external_pvtables.json', JSON.stringify(external_pvtables), function (err) {
    if (err) throw err;
    // console.log('It\'s saved!');
});
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
                external: ['vue', 'primevue', 'axios', ...external_packages, ...external_pvtables],
                output: {
                    globals: {
                        vue: 'Vue'
                    }
                }
            }
        }
    });
});

