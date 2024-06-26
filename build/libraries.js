
const libs = {
    api:{
        path:'../api/main_api.js',
    },
    pvtables:{
        path:'../pvtables/index.js',
        entry:'../pvtables/index.js',
        css:'../pvtables/style.css',
    },
    pvtable:{
        path:'../pvtable/PVTable.vue',
        entry:'../pvtable/pvtable_main.js',
    },
    pvtabs:{
        path:'../pvtabs/index.js',
        entry:'../pvtabs/index.js',
    },
    pvtab:{
        path:'../pvtab/PVTab.vue',
        entry:'../pvtab/pvtab_main.js',
    },
    gtsautocomplete:{
        path:'../gtsautocomplete/gtsAutoComplete.vue',
        css:'../gtsautocomplete/style.css',
    },
    gtsselect:{
        path:'../gtsselect/gtsSelect.vue'
    },
    gtsdate:{
        path:'../gtsdate/GTSDate.vue'
    },
    notify:{
        path:'../notify/useNotifications.js'
    },
}
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let libraries = {}
for(let key in libs){
    libraries[key] = {}
    libraries[key].path = resolve(__dirname, libs[key].path)
    if(libs[key].entry)  libraries[key].entry = resolve(__dirname, libs[key].entry);
    if(libs[key].css)  libraries[key].css = resolve(__dirname, libs[key].css);
}
export default libraries