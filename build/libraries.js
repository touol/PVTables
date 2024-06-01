import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path'
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    api:{
        path:resolve(__dirname, '../api/main_api.js'),
    },
    pvtables:{
        path:resolve(__dirname, '../pvtables/index.js'),
        entry:resolve(__dirname, '../pvtables/index.js'),
    },
    pvtable:{
        path:resolve(__dirname, '../pvtable/PVTable.vue'),
        entry:resolve(__dirname, '../pvtable/pvtable_main.js'),
    },
    pvtabs:{
        path:resolve(__dirname, '../pvtabs/PVTabs.vue'),
        entry:resolve(__dirname, '../pvtabs/index.js'),
    },
    pvtab:{
        path:resolve(__dirname, '../pvtab/PVTab.vue'),
        entry:resolve(__dirname, '../pvtab/pvtab_main.js'),
    },
    gtsautocomplete:{
        path:resolve(__dirname, '../gtsautocomplete/gtsAutoComplete.vue')
    },
    gtsselect:{
        path:resolve(__dirname, '../gtsselect/gtsSelect.vue')
    },
    gtsdate:{
        path:resolve(__dirname, '../gtsdate/GTSDate.vue')
    },
    notify:{
        path:resolve(__dirname, '../notify/useNotifications.js')
    },
}