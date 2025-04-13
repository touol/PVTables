import PVTables from './PVTables.vue'
import PVTab from './components/PVTab.vue'
import apiCtor from './components/api.js'
import gtsAutoComplete from './components/gtsAutoComplete.vue'
import PVAutoComplete from './components/PVAutoComplete.vue'
import gtsDate from './components/gtsDate.vue'
import gtsSelect from './components/gtsSelect.vue'
import PVTable from './components/PVTable.vue'
import PVForm from './components/PVForm.vue'
import PVTableModel from './components/PVTableModel.vue'
import EditField from "./components/EditField.vue";
import { useNotifications } from './components/useNotifications.js'
import UniTree from './components/UniTree.vue'
import UniTreePanel from './components/UniTreePanel.vue'
import UniTreeSplitButton from './components/UniTreeSplitButton.vue'

import 'primeicons/primeicons.css'
import './style.css'
import Lara from '@primevue/themes/lara/'
import PrimeVue from "primevue/config";

import Button from "primevue/button";
import Dialog from "primevue/dialog";
import ToggleSwitch from 'primevue/toggleswitch';
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import InputNumber from "primevue/inputnumber";
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import Toast from 'primevue/toast'
import MultiSelect from 'primevue/multiselect';
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Toolbar from "primevue/toolbar";

import localeRu from './locale/ru.json';

import Drawer from 'primevue/drawer';
  
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import Popover from 'primevue/popover';
import FileUpload from 'primevue/fileupload';
import SpeedDial from 'primevue/speeddial';
import InputGroup from "primevue/inputgroup";

export default {
    install: (app, options) => {
        app.use(PrimeVue, {
            theme: {
                preset: Lara,
                pt: Lara,
                options: {
                    darkModeSelector: '.my-app-dark',
                    cssLayer: {
                        name: 'primevue',
                        order: 'tailwind-base, primevue, tailwind-utilities'
                    }
                }
            },
            locale: localeRu.ru
        })
        app.component('gtsAutoComplete', gtsAutoComplete)
        app.component('PVAutoComplete', PVAutoComplete)
        
        app.component('PVTables', PVTables)
        app.component('PVTab', PVTab)
        app.component('apiCtor', apiCtor)
        
        app.component('gtsDate', gtsDate)
        app.component('gtsSelect', gtsSelect)
        app.component('PVTable', PVTable)
        app.component('PVForm', PVForm)
        app.component('PVTableModel', PVTableModel)
        app.component('EditField', EditField)
        app.component('useNotifications', useNotifications)
        
    }
}
export {
    PVTables as PVTables,
    PVTab as PVTab,
    apiCtor as apiCtor,
    gtsAutoComplete as gtsAutoComplete,
    PVAutoComplete as PVAutoComplete,
    gtsDate as gtsDate,
    PVTable as PVTable,
    PVForm as PVForm,
    PVTableModel as PVTableModel,
    EditField as EditField,
    useNotifications as useNotifications,
    UniTree as UniTree,
    UniTreePanel as UniTreePanel,
    UniTreeSplitButton as UniTreeSplitButton,

    
    Button as Button,
    Dialog as Dialog,
    ToggleSwitch as ToggleSwitch,
    InputText as InputText,
    Textarea as Textarea,
    InputNumber as InputNumber,
    Tabs as Tabs,
    TabList as TabList,
    Tab as Tab,
    TabPanels as TabPanels,
    TabPanel as TabPanel,
    Toast as Toast,
    Drawer as Drawer,
    Splitter as Splitter,
    SplitterPanel as SplitterPanel,
    Popover as Popover,
    MultiSelect as MultiSelect,
    FileUpload as FileUpload,
    SpeedDial as SpeedDial,
    DataTable as DataTable,
    Column as Column,
    Toolbar as Toolbar,
    InputGroup as InputGroup,
}