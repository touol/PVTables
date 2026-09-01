import PVTables from './PVTables.vue'
import PVTab from './components/PVTab.vue'
import PVTabs from './components/PVTabs.vue'
import apiCtor from './components/api.js'
import apiFetch from './components/api-ofetch.js'
import gtsAutoComplete from './components/gtsAutoComplete.vue'
import PVAutoComplete from './components/PVAutoComplete.vue'
import PVMultiAutoComplete from './components/PVMultiAutoComplete.vue'
import gtsDate from './components/gtsDate.vue'
import PVDateTime from './components/PVDateTime.vue'
import gtsSelect from './components/gtsSelect.vue'
import PVTable from './components/PVTable.vue'
import PVForm from './components/PVForm.vue'
import PVTableModel from './components/PVTableModel.vue'
import EditField from "./components/EditField.vue";
import { useNotifications } from './components/useNotifications.js'
import UniTree from './components/UniTree.vue'
import UniTreePanel from './components/UniTreePanel.vue'
import UniTreeSplitButton from './components/UniTreeSplitButton.vue'
import PVMenu from './components/PVMenu.vue'
import FileSelector from './components/filebrowser/FileSelector.vue';
import { FileGallery, FileUploadDialog, FileEditDialog, FileViewDialog, FileGalleryAPI, fileUtils } from './components/gtsAPIFileGallery/index.js'
// Форк PrimeVue DataTable выпилен 19.07.2026. Имя DataTable оставлено в экспорте
// как алиас на СТОКОВЫЙ primevue/datatable — им пользуется gtsShopAdmin
// (TableVariables.vue импортирует DataTable из 'pvtables/dist/pvtables').
// Сток и так в бандле (PVTableModel, filebrowser/FileView), лишнего веса нет.
import DataTable from "primevue/datatable";
import { ComponentLoader } from './utils/component-loader.js'

// Создаем глобальный PVTablesAPI для использования в динамически загружаемых компонентах
if (!window.PVTablesAPI) {
    window.PVTablesAPI = {
        useNotifications,
        apiCtor,
        apiFetch,
        ComponentLoader
    }
}


import 'primeicons/primeicons.css'
// L0 — корпоративные токены. Импортируется ПЕРВЫМ из наших стилей: всё
// остальное на них ссылается. Попадает в собранный pvtables.css, который
// сниппеты gtsAPI уже регистрируют, — отдельного файла на деплой не нужно.
import './theme/gts-tokens.css'
import './style.css'
import Lara from '@primevue/themes/lara/'
import { definePreset } from '@primevue/themes'
import PrimeVue from "primevue/config";

// --- L0 → PrimeVue ----------------------------------------------------------
// Пресет не задаёт ни одного цвета сам: он только протягивает токены из
// theme/gts-tokens.css в семантику PrimeVue. После этого все --p-* вытекают
// из --gts-*, и перекрасить систему целиком можно правкой одного файла.
//
// Цвета в light и dark одни и те же: --gts-* переключаются сами по
// [data-gts-scheme], и второй набор значений заставил бы править тему
// в двух местах. Исключение одно — лестница поверхностей, см. ниже.
// Лестница поверхностей PrimeVue. Она НЕ одинакова для схем, и это не
// симметрия ради симметрии.
//
// В светлой палитре surface.800..950 — тёмные, и Lara берёт их под ТЕКСТ.
// В тёмной палитре те же номера тёмные по-прежнему, и Lara берёт их уже под
// ФОН: 35 её компонентов в блоке dark ссылаются на surface.600..950 именно
// как на подложки и границы. Наши токены переворачиваются сами, поэтому
// прямая лестница в тёмной схеме отдавала под фон цвет текста — почти белый.
// Так и получалась белая полоса тулбара на тёмной странице.
//
// Решение: в тёмной схеме верх лестницы заворачивается обратно на поверхности.
const gtsSurfaceLight = {
    0:   'var(--gts-surface)',
    50:  'var(--gts-surface-2)',
    100: 'var(--gts-surface-3)',
    200: 'var(--gts-line)',
    300: 'var(--gts-line-strong)',
    400: 'var(--gts-ink-3)',
    500: 'var(--gts-ink-3)',
    600: 'var(--gts-ink-2)',
    700: 'var(--gts-ink-2)',
    800: 'var(--gts-ink)',
    900: 'var(--gts-ink)',
    950: 'var(--gts-ink)'
};

const gtsSurfaceDark = {
    0:   'var(--gts-surface)',
    50:  'var(--gts-surface-2)',
    100: 'var(--gts-surface-3)',
    200: 'var(--gts-line)',
    300: 'var(--gts-line-strong)',
    400: 'var(--gts-ink-3)',
    500: 'var(--gts-ink-3)',
    // дальше — не текст, а подложки и границы: см. комментарий выше
    600: 'var(--gts-line-strong)',
    700: 'var(--gts-line)',
    800: 'var(--gts-surface-3)',
    900: 'var(--gts-surface-2)',
    950: 'var(--gts-surface)'
};

const gtsColors = {
    primary: {
        color:         'var(--gts-accent)',
        contrastColor: 'var(--gts-accent-contrast)',
        hoverColor:    'var(--gts-accent-hover)',
        activeColor:   'var(--gts-accent-active)'
    },
    highlight: {
        background:      'var(--gts-accent-soft)',
        focusBackground: 'var(--gts-accent-soft)',
        color:           'var(--gts-accent)',
        focusColor:      'var(--gts-accent)'
    },
    content: {
        background:      'var(--gts-surface)',
        hoverBackground: 'var(--gts-surface-2)',
        borderColor:     'var(--gts-line)',
        color:           'var(--gts-ink)',
        hoverColor:      'var(--gts-ink)'
    },
    text: {
        color:           'var(--gts-ink)',
        hoverColor:      'var(--gts-ink)',
        mutedColor:      'var(--gts-ink-2)',
        hoverMutedColor: 'var(--gts-ink)'
    },
    formField: {
        background:              'var(--gts-surface)',
        disabledBackground:      'var(--gts-disabled-bg)',
        filledBackground:        'var(--gts-surface-2)',
        filledHoverBackground:   'var(--gts-surface-2)',
        filledFocusBackground:   'var(--gts-surface)',
        borderColor:             'var(--gts-line-strong)',
        hoverBorderColor:        'var(--gts-accent)',
        focusBorderColor:        'var(--gts-accent)',
        invalidBorderColor:      'var(--gts-danger)',
        color:                   'var(--gts-ink)',
        disabledColor:           'var(--gts-disabled-ink)',
        placeholderColor:        'var(--gts-ink-3)',
        invalidPlaceholderColor: 'var(--gts-danger)',
        floatLabelColor:         'var(--gts-ink-2)',
        iconColor:               'var(--gts-ink-3)',
        shadow:                  'none'
    },
    overlay: {
        select:  { background: 'var(--gts-surface)', borderColor: 'var(--gts-line)', color: 'var(--gts-ink)' },
        popover: { background: 'var(--gts-surface)', borderColor: 'var(--gts-line)', color: 'var(--gts-ink)' },
        modal:   { background: 'var(--gts-surface)', borderColor: 'var(--gts-line)', color: 'var(--gts-ink)' }
    },
    list: {
        option: {
            focusBackground:         'var(--gts-surface-3)',
            selectedBackground:      'var(--gts-accent-soft)',
            selectedFocusBackground: 'var(--gts-accent-soft)',
            color:                   'var(--gts-ink)',
            focusColor:              'var(--gts-ink)',
            selectedColor:           'var(--gts-accent)',
            selectedFocusColor:      'var(--gts-accent)'
        }
    },
    navigation: {
        item: {
            focusBackground:  'var(--gts-surface-3)',
            activeBackground: 'var(--gts-accent-soft)',
            color:            'var(--gts-ink)',
            focusColor:       'var(--gts-ink)',
            activeColor:      'var(--gts-accent)'
        }
    }
};

// Цвета severity-классов: p-button-success / -danger / -secondary.
// Смысл сохранён прежний, но взят из семантической оси токенов, а не из хексов:
// «удалить» остаётся красным при любой теме.
const gtsButtons = {
    root: {
        // Вставить / Создать — сплошной зелёный
        success: {
            background: 'var(--gts-ok)', hoverBackground: 'var(--gts-ok-hover)', activeBackground: 'var(--gts-ok-hover)',
            borderColor: 'var(--gts-ok)', hoverBorderColor: 'var(--gts-ok-hover)', activeBorderColor: 'var(--gts-ok-hover)',
            color: 'var(--gts-accent-contrast)', hoverColor: 'var(--gts-accent-contrast)', activeColor: 'var(--gts-accent-contrast)',
            focusRing: { color: 'var(--gts-ok)', shadow: 'none' }
        },
        // Удалить — мягкий красный: светлый фон, красный текст и бордюр
        danger: {
            background: 'var(--gts-danger-soft)', hoverBackground: 'var(--gts-danger-soft-hover)', activeBackground: 'var(--gts-danger-soft-hover)',
            borderColor: 'var(--gts-danger)', hoverBorderColor: 'var(--gts-danger-hover)', activeBorderColor: 'var(--gts-danger-hover)',
            color: 'var(--gts-danger)', hoverColor: 'var(--gts-danger-hover)', activeColor: 'var(--gts-danger-hover)',
            focusRing: { color: 'var(--gts-danger)', shadow: 'none' }
        },
        // Кнопки-иконки тулбара таблицы (отменить / повторить / обновить /
        // фильтры / настройки). Их не было в пресете, поэтому они брали
        // синий из Lara и оставались синими при любой теме.
        info: {
            background: 'var(--gts-info)', hoverBackground: 'var(--gts-info-hover)', activeBackground: 'var(--gts-info-hover)',
            borderColor: 'var(--gts-info)', hoverBorderColor: 'var(--gts-info-hover)', activeBorderColor: 'var(--gts-info-hover)',
            color: 'var(--gts-accent-contrast)', hoverColor: 'var(--gts-accent-contrast)', activeColor: 'var(--gts-accent-contrast)',
            focusRing: { color: 'var(--gts-info)', shadow: 'none' }
        },
        warn: {
            background: 'var(--gts-warn)', hoverBackground: 'var(--gts-warn-hover)', activeBackground: 'var(--gts-warn-hover)',
            borderColor: 'var(--gts-warn)', hoverBorderColor: 'var(--gts-warn-hover)', activeBorderColor: 'var(--gts-warn-hover)',
            color: 'var(--gts-accent-contrast)', hoverColor: 'var(--gts-accent-contrast)', activeColor: 'var(--gts-accent-contrast)',
            focusRing: { color: 'var(--gts-warn)', shadow: 'none' }
        },
        // Excel / Выбрать принтер — нейтральный: фон карточки, серый бордюр
        secondary: {
            background: 'var(--gts-surface)', hoverBackground: 'var(--gts-surface-2)', activeBackground: 'var(--gts-surface-3)',
            borderColor: 'var(--gts-line-strong)', hoverBorderColor: 'var(--gts-line-strong)', activeBorderColor: 'var(--gts-line-strong)',
            color: 'var(--gts-ink-2)', hoverColor: 'var(--gts-ink)', activeColor: 'var(--gts-ink)',
            focusRing: { color: 'var(--gts-line-strong)', shadow: 'none' }
        }
    }
};

const gtsPreset = definePreset(Lara, {
    primitive: {
        borderRadius: {
            none: '0',
            xs:   'var(--gts-radius-s)',
            sm:   'var(--gts-radius-s)',
            md:   'var(--gts-radius)',
            lg:   'var(--gts-radius)',
            xl:   'var(--gts-radius-l)'
        }
    },
    semantic: {
        transitionDuration: 'var(--gts-duration)',
        // Шкала primary: PrimeVue обращается к ней по номерам, поэтому
        // три наших оттенка размазаны по одиннадцати ступеням.
        primary: {
            50:  'var(--gts-accent-soft)',   100: 'var(--gts-accent-soft)',   200: 'var(--gts-accent-soft)',
            300: 'var(--gts-accent)',        400: 'var(--gts-accent)',        500: 'var(--gts-accent)',
            600: 'var(--gts-accent-hover)',  700: 'var(--gts-accent-hover)',
            800: 'var(--gts-accent-active)', 900: 'var(--gts-accent-active)', 950: 'var(--gts-accent-active)'
        },
        focusRing: { width: '3px', style: 'solid', color: 'var(--gts-accent)', offset: '0', shadow: 'none' },
        content:   { borderRadius: 'var(--gts-radius)' },
        overlay: {
            select:  { borderRadius: 'var(--gts-radius)' },
            popover: { borderRadius: 'var(--gts-radius-l)' },
            modal:   { borderRadius: 'var(--gts-radius-l)' }
        },
        formField: {
            paddingX:     'var(--gts-control-pad-x)',
            borderRadius: 'var(--gts-radius)',
            focusRing:    { width: '3px', style: 'solid', color: 'var(--gts-accent)', offset: '0', shadow: 'none' }
        },
        colorScheme: {
            light: { ...gtsColors, surface: gtsSurfaceLight },
            dark:  { ...gtsColors, surface: gtsSurfaceDark }
        }
    },
    components: {
        button: {
            root: {
                borderRadius: 'var(--gts-radius)',
                paddingX:     'var(--gts-control-pad-x)',
                label:        { fontWeight: 'var(--gts-weight-med)' }
            },
            colorScheme: { light: gtsButtons, dark: gtsButtons }
        }
    }
});

import Button from "primevue/button";
import Dialog from "primevue/dialog";
import ToggleSwitch from 'primevue/toggleswitch';
import Checkbox from 'primevue/checkbox';
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import InputNumber from "primevue/inputnumber";
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
// Наружу отдаём синглтон-обёртку, а не голый primevue/toast: <Toast/> подписан
// на общую шину и каждая копия рисует каждое сообщение. Приложения монтируют
// свой <Toast/> в App.vue, библиотека — свои внутри таблиц и вкладок; на странице
// расчёта их набиралось четыре, и пользователь видел четыре одинаковых тоста.
// Обёртка оставляет право рисовать одному экземпляру. Приложения не правим.
import Toast from './components/PVToast.vue'
import MultiSelect from 'primevue/multiselect';

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
import Tree from 'primevue/tree';
import Select from 'primevue/select';
import Menubar from 'primevue/menubar';
import Card from 'primevue/card';
import Panel from 'primevue/panel';
import Badge from 'primevue/badge';
import Tag from 'primevue/tag';

export default {
    install: (app, options) => {
        // Создаем ComponentLoader только если он еще не существует глобально
        if (!window.componentLoader) {
            const componentLoader = new ComponentLoader(app)
            app.provide('componentLoader', componentLoader)
            window.componentLoader = componentLoader
        } else {
            // Используем существующий ComponentLoader
            app.provide('componentLoader', window.componentLoader)
        }
        
        app.use(PrimeVue, {
            theme: {
                preset: gtsPreset,
                pt: Lara,
                options: {
                    // Тот же признак, что и у наших токенов, — иначе PrimeVue
                    // считал бы схему по-своему и расходился с --gts-*.
                    // Сниппет gtsTheme всегда проставляет явное значение
                    // (системную настройку он разрешает сам), поэтому
                    // селектор срабатывает и когда пользователь не выбирал.
                    darkModeSelector: '[data-gts-scheme="dark"]',
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
        app.component('PVMultiAutoComplete', PVMultiAutoComplete)

        app.component('PVTables', PVTables)
        app.component('PVTab', PVTab)
        app.component('apiCtor', apiCtor)
        
        app.component('gtsDate', gtsDate)
        app.component('PVDateTime', PVDateTime)
        app.component('gtsSelect', gtsSelect)
        app.component('PVTable', PVTable)
        app.component('PVForm', PVForm)
        app.component('PVTableModel', PVTableModel)
        app.component('EditField', EditField)
        
        // Компоненты галереи файлов
        app.component('FileGallery', FileGallery)
        app.component('FileUploadDialog', FileUploadDialog)
        app.component('FileEditDialog', FileEditDialog)
        app.component('FileViewDialog', FileViewDialog)
        
    }
}
export {
    PVTables as PVTables,
    PVTab as PVTab,
    PVTabs as PVTabs,
    apiCtor as apiCtor,
    apiFetch as apiFetch,
    gtsAutoComplete as gtsAutoComplete,
    PVAutoComplete as PVAutoComplete,
    PVMultiAutoComplete as PVMultiAutoComplete,
    gtsDate as gtsDate,
    PVDateTime as PVDateTime,
    PVTable as PVTable,
    PVForm as PVForm,
    PVTableModel as PVTableModel,
    EditField as EditField,
    useNotifications as useNotifications,
    UniTree as UniTree,
    UniTreePanel as UniTreePanel,
    UniTreeSplitButton as UniTreeSplitButton,
    PVMenu as PVMenu,
    FileSelector as FileSelector,
    DataTable as DataTable,
    
    // Компоненты галереи файлов
    FileGallery as FileGallery,
    FileUploadDialog as FileUploadDialog,
    FileEditDialog as FileEditDialog,
    FileViewDialog as FileViewDialog,
    FileGalleryAPI as FileGalleryAPI,
    fileUtils as fileUtils,
    
    // ComponentLoader
    ComponentLoader as ComponentLoader,
    
    Button as Button,
    Dialog as Dialog,
    ToggleSwitch as ToggleSwitch,
    Checkbox as Checkbox,
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
    Column as Column,
    Toolbar as Toolbar,
    InputGroup as InputGroup,
    Tree as Tree,
    Select as Select,
    Menubar as Menubar,
    Card as Card,
    Panel as Panel,
    Badge as Badge,
    Tag as Tag,
}

// Глобал window.PVTables для UMD-компонентов (PVPrint и др.),
// которые резолвят pvtables/dist/pvtables → window.PVTables
if (typeof window !== 'undefined' && !window.PVTables) {
    window.PVTables = {
        Button, Dialog, ToggleSwitch, Checkbox, InputText, Textarea,
        InputNumber, Tabs, TabList, Tab, TabPanels, TabPanel, Toast,
        Drawer, Splitter, SplitterPanel, Popover, MultiSelect,
        FileUpload, SpeedDial, Column, Toolbar, InputGroup, Tree,
        Select, Menubar, Card, Panel, Badge, Tag,
        PVTables, PVTab, PVTabs, apiCtor, apiFetch,
        gtsAutoComplete, PVAutoComplete, PVMultiAutoComplete, gtsDate, PVDateTime,
        PVTable, PVForm, PVTableModel, EditField, useNotifications,
        UniTree, UniTreePanel, UniTreeSplitButton, PVMenu,
        FileSelector, DataTable, ComponentLoader,
        FileGallery, FileUploadDialog, FileEditDialog, FileViewDialog,
        FileGalleryAPI, fileUtils,
    }
}
