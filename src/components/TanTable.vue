<script setup>
/**
 * TanTable — полная замена PVTables.vue на TanStack Table + TanStack Virtual.
 *
 * Самодостаточен: сам загружает данные через API, инициализирует все
 * composables, управляет CRUD, расширением строк (subtables/subtabs).
 *
 * Props идентичны PVTables.vue — компонент является drop-in replacement.
 * Переключение обратно на PrimeVue: emit('switch-engine').
 */
import './TanTable.css'

import { ref, computed, h, watch, nextTick, onMounted, onBeforeUnmount, customRef } from 'vue'
import {
  useVueTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  FlexRender,
} from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'

import Button   from 'primevue/button'
import Dialog   from 'primevue/dialog'
import Toast    from 'primevue/toast'
import Checkbox from 'primevue/checkbox'
import Popover  from 'primevue/popover'

import PVForm              from './PVForm.vue'
import PVTabs              from './PVTabs.vue'
import PVTablesSplitButton from './PVTablesSplitButton.vue'
import FileBrowser         from './filebrowser/FileBrowser.vue'

import { useNotifications }    from './useNotifications'
import apiCtor                 from './api'
import { usePVTableData }      from '../composables/usePVTableData'
import { usePVTableFilters }   from '../composables/usePVTableFilters'
import { usePVTableActions }   from '../composables/usePVTableActions'
import { useTanCRUD }          from '../composables/useTanCRUD'
import { usePVTableExpand }    from '../composables/usePVTableExpand'
import { useActionsCaching }   from '../composables/useActionsCaching'
import { useTanColSizing }     from '../composables/useTanColSizing'
import { useRowHighlight }    from '../composables/useRowHighlight'
import { useTanFilterPopover } from '../composables/useTanFilterPopover'
import { useTanCellSelection } from '../composables/useTanCellSelection'
import { useMobileLayout }    from '../composables/useMobileLayout'
import { useTanRowDrag }     from '../composables/useTanRowDrag'

import TanToolbar         from './TanToolbar.vue'
import TanPaginator       from './TanPaginator.vue'
import TanFilterPopoverUI from './TanFilterPopoverUI.vue'
import TanSettingsPopover from './TanSettingsPopover.vue'
import TanEditCell        from './TanEditCell.vue'
import EditField          from './EditField.vue'

// ─── Props (идентичны PVTables.vue) ───────────────────────────────────────
const props = defineProps({
  table:          { type: String,  required: true },
  actions:        { type: Object,  default: () => ({}) },
  filters:        { type: Object,  default: () => ({}) },
  sorting:        { type: Array,   default: () => [] },
  child:          { type: Boolean, default: false },
  scrollHeight:   { type: String,  default: '85vh' },
  autoFitHeight:  { type: Boolean, default: false },
  emptyRowsCount: { type: Number,  default: 0 },
})

const emit = defineEmits(['get-response', 'refresh-table', 'switch-engine'])

// ─── API + Notifications ──────────────────────────────────────────────────
const api = apiCtor(props.table)
const { notify } = useNotifications()
const { cacheAction, undo, redo, canUndo, canRedo, init: initUndoRedo } = useActionsCaching()

// ─── State (инициализируется в onMounted из api.options()) ────────────────
const columns     = ref([{ field: 'id', label: 'ID' }])
const hideId      = ref(false)
const table_tree  = ref(null)
const dataFields  = ref([])
const selectSettings     = ref({})
const row_class_trigger  = ref({})
const globalFilterFields = ref([])
const actionsFrozen = ref(null)
const rowDrag       = ref(false)
const form          = ref({})
const actions1      = ref({})

const visibleColumns = computed(() =>
  columns.value.filter(
    x => x.modal_only != true && x.type != 'hidden' && !(hideId.value && x.field == 'id')
  )
)

// Поля таблицы (нужны в saveCellUpdate для updateEmptyRow)
const fieldsRef = ref({})

// ─── Data composable ──────────────────────────────────────────────────────
const {
  loading, totalRecords, first, lineItems, lazyParams,
  autocompleteSettings, dynamicSelects, row_setting, customFields,
  filterList, createLoadLazyData, createOnPage,
  findIndexById, emptyRowsState, updateEmptyRow, isEmptyRow, isEditableEmptyRow,
} = usePVTableData(props.emptyRowsCount)

const { rowClass, rowStyle, cellClass, cellStyle } = useRowHighlight(row_setting, row_class_trigger)

const rowsPerPage = ref(10)

watch(dynamicSelects, (v) => {
  for (let k in v) selectSettings.value[k] = v[k]
}, { deep: true })

// ─── Filter / Sort / Page (инициализируется в onMounted) ─────────────────
let loadLazyData, onPage
let filters, topFilters, initFilters, onSetTopFilter, prepFilters, clearFilter
let topFilters0 = {}

// Watch props.filters на верхнем уровне — здесь currentInstance гарантирован.
watch(() => props.filters, () => {
  if (!loadLazyData) return
  initFilters?.()
  first.value = 0
  if (lazyParams.value) lazyParams.value.first = 0
  loadLazyData()
}, { deep: true })

const refresh = (from_parent, tbl) => {
  if (!tbl || tbl == props.table) {
    loadLazyData?.()
    if (!from_parent) emit('refresh-table')
  } else if (tbl && childComponentRefs.value) {
    for (let id in childComponentRefs.value) {
      childComponentRefs.value[id].refresh?.(true, tbl)
    }
  }
}

// ─── Row selection ────────────────────────────────────────────────────────
const selectedlineItems = ref([])

// ─── CRUD (инициализируется в onMounted через useTanCRUD) ─────────────────
let lineItem, lineItemDialog, deleteLineItemDialog, deleteLineItemsDialog
let openNew, editLineItem, hideDialog, saveLineItem
let confirmDeleteLineItem, deleteLineItem, confirmDeleteSelected, deleteSelectedLineItems
let mywatch
let saveCellUpdate, consumeSkip

// ─── Actions (инициализируется в onMounted) ───────────────────────────────
const cur_actions      = ref([])
const nemu_actions     = ref({})
const actions_row      = ref(false)
const SpeedDialEnabled = ref(false)
const speedDialActions = ref([])
const modalFormDialog  = ref(false)
const modalFormData    = ref({})
const modalFormAction  = ref(null)
const modalFormRowData = ref(null)
const modalFormType    = ref(null)
const modalFormColumns = ref([])

const headActions = computed(() => cur_actions.value.filter(x => x.head))
const rowActions  = computed(() => cur_actions.value.filter(x => x.row && x.menu !== 1))

let actionsComposable, hideModalForm, submitModalForm

// ─── Expand (инициализируется в onMounted) ────────────────────────────────
const childComponentRefs = ref({})
let subsComposable, subfiltersComposable, parentRowComposable
let setExpandedRowComposable, toogleExpandRowComposable, expandedTableTreeRowsComposable

// ─── acMaps / selectMaps (O(1) lookup) ───────────────────────────────────
const acMaps = computed(() => {
  const maps = {}
  for (const field in autocompleteSettings.value) {
    const rows = autocompleteSettings.value[field]?.rows
    if (rows && Array.isArray(rows)) {
      const m = new Map()
      for (const o of rows) m.set(String(o.id), o.content)
      maps[field] = m
    }
  }
  return maps
})
// Full row data map for show_id lookup
const acFullMaps = computed(() => {
  const maps = {}
  for (const field in autocompleteSettings.value) {
    const rows = autocompleteSettings.value[field]?.rows
    if (rows && Array.isArray(rows)) {
      const m = new Map()
      for (const o of rows) m.set(String(o.id), o)
      maps[field] = m
    }
  }
  return maps
})
const selectMaps = computed(() => {
  const maps = {}
  for (const field in selectSettings.value) {
    const rows = selectSettings.value[field]?.rows
    if (rows && Array.isArray(rows)) {
      const m = new Map()
      for (const o of rows) m.set(String(o.id), o.content ?? o.label ?? '')
      maps[field] = m
    }
  }
  return maps
})

const getACContent     = (field, value) => acMaps.value[field]?.get(String(value)) ?? ''
const getSelectContent = (field, value) => selectMaps.value[field]?.get(String(value)) ?? ''

// ─── Cell rendering helpers ───────────────────────────────────────────────
const getFieldValue = (data, field) => {
  if (!field.includes('.')) return data[field]
  return field.split('.').reduce((acc, k) => acc?.[k], data)
}
const formatDate = (v) => {
  if (!v) return ''
  return v.split('-').reverse().join('.')
}
const formatNumber = (num) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num)
const formatDateTime = (v) => {
  if (!v) return ''
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return v
  const [, y, mo, d, hh = '', mm = ''] = m
  return hh ? `${d}.${mo}.${y} ${hh}:${mm}` : `${d}.${mo}.${y}`
}
const formatDecimal = (text, fractionDigits = 2) => {
  if (text === '' || text == null) text = 0
  const parts = parseFloat(text).toFixed(fractionDigits).toString().split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return parts.join(',')
}
const truncateText = (text, max) => {
  if (!text) return ''
  const s = String(text)
  return s.length <= max ? s : s.slice(0, max) + '…'
}

// ─── Scroll height (localStorage per table) ──────────────────────────────
const HEIGHT_KEY = `tan-scroll-height-${props.table}`
const localScrollHeight = ref(localStorage.getItem(HEIGHT_KEY) || props.scrollHeight || '85vh')
const autoFitHeight = ref(props.autoFitHeight || false)

watch(localScrollHeight, v => { try { if (!autoFitHeight.value) localStorage.setItem(HEIGHT_KEY, v || '85vh') } catch {} })
watch(() => props.scrollHeight, v => {
  if (v && !localStorage.getItem(HEIGHT_KEY)) localScrollHeight.value = v
})
watch(() => props.autoFitHeight, v => { autoFitHeight.value = v })

const calculateTableHeight = () => {
  if (!autoFitHeight.value || !rootElRef.value) return
  setTimeout(() => {
    try {
      const windowHeight = window.innerHeight
      const rootRect = rootElRef.value.getBoundingClientRect()
      const rootTop = rootRect.top
      // Find toolbar, paginator and status bar heights inside root
      const toolbar = rootElRef.value.querySelector('.p-toolbar')
      const paginator = rootElRef.value.querySelector('.tan-paginator')
      const statusBar = rootElRef.value.querySelector('.tan-status-bar')
      const thead = rootElRef.value.querySelector('.tan-thead')
      const toolbarH = toolbar ? toolbar.offsetHeight : 0
      const paginatorH = paginator ? paginator.offsetHeight : 0
      const statusBarH = statusBar ? statusBar.offsetHeight : 0
      const theadH = 0 //thead ? thead.offsetHeight : 0
      const bottomPadding = 20
      const available = windowHeight - rootTop - toolbarH - paginatorH - statusBarH - theadH - bottomPadding
      localScrollHeight.value = `${Math.max(200, available)}px`
    } catch {}
  }, 100)
}

const onAutoFitHeightToggle = () => {
  if (autoFitHeight.value) {
    calculateTableHeight()
    window.addEventListener('resize', calculateTableHeight)
  } else {
    localScrollHeight.value = localStorage.getItem(HEIGHT_KEY) || props.scrollHeight || '85vh'
    window.removeEventListener('resize', calculateTableHeight)
  }
}

watch(autoFitHeight, () => onAutoFitHeightToggle())

onBeforeUnmount(() => {
  window.removeEventListener('resize', calculateTableHeight)
})

// ─── Scroll container ref ─────────────────────────────────────────────────
const scrollRef = ref(null)
const rootElRef = ref(null)

// ─── Mobile layout ────────────────────────────────────────────────────────
const { isMobile, forceDesktop, setForceDesktop } = useMobileLayout()
const showMobileSwitch = computed(() => isMobile.value && forceDesktop.value)

// Размер кнопки действия — читается из CSS-переменной PrimeVue после монтирования
const actionBtnSize = ref(32)

// ─── Column sizing composable ─────────────────────────────────────────────
const {
  serverFieldsStyle,
  columnSizing,
  autoFitCols,
  getColDefaultSize,
  saveWidthsToLocal,
  initColumnWidths,
  fitColumnsToContainer,
  saveFieldsStyleToServer,
  resetLocalWidths,
  resetServerWidths,
  onResizeMouseDown,
} = useTanColSizing({
  tableName: props.table,
  api,
  notify,
  scrollRef,
  actionsRow: actions_row,
  rowActions,
  visibleColumns,
  tableTree: table_tree,
  speedDialEnabled: SpeedDialEnabled,
  rowsGetter: () => tableInstance?.getRowModel?.().rows.map(r => r.original) ?? [],
  actionBtnSize,
  rowDrag,
})

// ─── TanStack column definitions ──────────────────────────────────────────
const stringIncludesFilter = (row, columnId, filterValue) => {
  const val = row.getValue(columnId)
  // Чеклист фильтр — Set значений
  if (filterValue instanceof Set) return filterValue.has(String(val ?? ''))
  return String(val ?? '').toLowerCase().includes(String(filterValue).toLowerCase())
}

const dragColDef = {
  id: '__drag__', size: 28, minSize: 28, maxSize: 28,
  enableResizing: false, enableSorting: false, enableColumnFilter: false,
  header: () => '',
  cell: () => h('span', { class: 'tan-drag-handle', title: 'Перетащить' }, '⠿'),
}

const selectionColDef = {
  id: '__select__', size: 38, minSize: 38, maxSize: 38,
  enableResizing: false, enableSorting: false, enableColumnFilter: false,
  header: ({ table }) => h(Checkbox, {
    modelValue: table.getIsAllRowsSelected() ? true : (table.getIsSomeRowsSelected() ? null : false),
    binary: true,
    'onUpdate:modelValue': () => table.toggleAllRowsSelected(),
    style: 'display:flex; align-items:center; justify-content:center',
  }),
  cell: ({ row }) => h(Checkbox, {
    modelValue: row.getIsSelected(),
    binary: true,
    'onUpdate:modelValue': () => row.toggleSelected(),
  }),
}

const expandColDef = {
  id: '__expand__', size: 34, minSize: 34, maxSize: 34,
  enableResizing: false, enableSorting: false, enableColumnFilter: false,
  header: () => '',
  cell: ({ row }) => {
    if (!(row.original['gtsapi_children_count'] > 0)) return null
    const isExpanded = expandedTableTreeRowsComposable?.value?.[row.original._rowKey]
    return h('button', {
      class: 'tan-expand-btn',
      onClick: () => { if (toogleExpandRowComposable) toogleExpandRowComposable(row.original) },
      title: isExpanded ? 'Свернуть' : 'Развернуть',
    }, h('i', { class: isExpanded ? 'pi pi-angle-down' : 'pi pi-angle-right' }))
  },
}

const actionsColDef = computed(() => ({
  id: '__actions__',
  size: rowActions.value.length * (actionBtnSize.value + 2) + (SpeedDialEnabled.value ? (actionBtnSize.value + 2) : 0) + 8,
  minSize: actionBtnSize.value + 2,
  enableResizing: false, enableSorting: false, enableColumnFilter: false,
  header: () => '',
  cell: ({ row }) => h('div', { style: 'display:flex;gap:2px;align-items:center' }, [
    ...rowActions.value.map(action =>
      action.compiledTemplate
        ? h(action.compiledTemplate, {
            data: row.original,
            columns: columns.value,
            table: props.table,
            filters,
            action,
            'onAction-click': () => action.click?.(row.original, columns.value, props.table, filters),
          })
        : h('button', {
            class: `tan-action-btn ${action.class || ''}`,
            title: action.label || '',
            onClick: () => action.click?.(row.original, columns.value, props.table, filters),
          }, h('i', { class: action.icon || 'pi pi-cog' }))
    ).filter(Boolean),
    SpeedDialEnabled.value
      ? h(PVTablesSplitButton, {
          actions: nemu_actions.value,
          onPvtablesMenuAction: (e) => {
            if (nemu_actions.value[e.action]?.click)
              nemu_actions.value[e.action].click(row.original, columns.value, props.table, filters)
          },
        })
      : null,
  ]),
}))

const dataColDefs = computed(() =>
  visibleColumns.value.map(col => ({
    id: col.field,
    accessorFn: row => getFieldValue(row, col.field),
    header: col.label || col.field,
    size: getColDefaultSize(col),
    minSize: 40,
    maxSize: 1200,
    enableSorting: col.type !== 'html',
    enableColumnFilter: col.type !== 'html',
    filterFn: stringIncludesFilter,
    meta: col,
    cell: ({ getValue, row }) => {
      const value = getValue()
      const data  = row.original
      if (value === null || value === undefined) return ''
      switch (col.type) {
        case 'decimal':  return formatDecimal(value, col.FractionDigits)
        case 'boolean':  return h(Checkbox, { modelValue: value == 1 || value === true, binary: true, disabled: true })
        case 'date':     return formatDate(value)
        case 'datetime': return formatDateTime(value)
        case 'html':     return h('span', { innerHTML: String(value) })
        case 'file': {
          const s = String(value || '')
          const shortName = s ? (s.split('/').pop() || s) : ''
          const browseBtn = h('i', {
            class: 'pi pi-folder-open',
            style: 'cursor:pointer;padding:2px 4px;flex-shrink:0;',
            title: 'Выбрать файл',
            onClick: (e) => { e.stopPropagation(); openFileBrowserForCell(col, data) },
          })
          if (!s) {
            return h('div', { class: 'tan-file-cell', style: 'display:flex;gap:4px;align-items:center;' }, [
              h('span', { style: 'color:#9ca3af;flex:1;' }, '—'),
              browseBtn,
            ])
          }
          return h('div', { class: 'tan-file-cell', style: 'display:flex;gap:4px;align-items:center;overflow:hidden;' }, [
            h('span', {
              class: 'tan-file-link',
              style: 'cursor:pointer;color:#1d4ed8;text-decoration:underline;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;',
              title: s,
              onClick: (e) => { e.stopPropagation(); onFilePreview(s, col.mediaSource) },
            }, shortName),
            browseBtn,
          ])
        }
        case 'autocomplete': {
          if (!value || value == 0) return ''
          const lbl = getACContent(col.field, value)
          if (col.hide_id) return lbl
          if (col.show_id) {
            const fullRow = acFullMaps.value[col.field]?.get(String(value))
            const sv = fullRow?.[col.show_id]
            const showVal = (sv !== null && sv !== undefined && sv !== '' && sv != 0) ? sv : value
            return `${showVal} ${lbl}`
          }
          return `${value} ${lbl}`
        }
        case 'multiautocomplete': {
          if (!value || value == 0) return ''
          const mainContent = getACContent(col.field, value) || ''
          const parts = mainContent !== '' ? [String(mainContent)] : []
          const fullRow = acFullMaps.value[col.field]?.get(String(value))
          const searchFields = autocompleteSettings.value[col.field]?.searchFields
          if (col.search && fullRow) {
            for (const key in col.search) {
              const id = fullRow[key]
              if (id === null || id === undefined || id === '' || id == 0) continue
              const rows = searchFields?.[key]?.rows
              let txt = id
              if (Array.isArray(rows)) {
                const found = rows.find(r => String(r.id) === String(id))
                if (found?.content !== undefined && found?.content !== null && found?.content !== '') txt = found.content
              }
              parts.push(String(txt))
            }
          }
          return parts.length ? parts.join(' ') : String(value)
        }
        case 'select': {
          const lbl = getSelectContent(col.field, value)
          if (lbl) return lbl
          // fallback: select_data из customFields конкретной строки
          const cfRows = customFields.value[data.id]?.[col.field]?.select_data
          if (cfRows) {
            const found = cfRows.find(o => String(o.id) === String(value))
            if (found) return found.content ?? found.label ?? String(value)
          }
          return String(value)
        }
        default: {
          const s = String(value)
          if (col.truncate && s.length > col.truncate) return h('span', { title: s }, truncateText(s, col.truncate))
          return s
        }
      }
    },
  }))
)

const hasExpandRows = computed(() => !!table_tree.value)

const allColDefs = computed(() => [
  ...(rowDrag.value ? [dragColDef] : []),
  selectionColDef,
  ...(hasExpandRows.value ? [expandColDef] : []),
  ...dataColDefs.value,
  ...(actions_row.value ? [actionsColDef.value] : []),
])

// ─── TanStack Table state ─────────────────────────────────────────────────
const rowSelection  = ref({})
const columnFilters = ref([])
const tanSorting    = ref([])
const expanded      = ref({})

watch(rowSelection, () => {
  selectedlineItems.value = tableInstance.getSelectedRowModel().rows.map(r => r.original)
}, { deep: true })

const tableInstance = useVueTable({
  get data()    { return lineItems.value },
  get columns() { return allColDefs.value },
  state: {
    get rowSelection()  { return rowSelection.value },
    get columnFilters() { return columnFilters.value },
    get sorting()       { return tanSorting.value },
    get expanded()      { return expanded.value },
    get columnSizing()  { return columnSizing.value },
  },
  // _rowKey — стабильный ключ, назначаемый usePVTableData; используется также в usePVTableExpand
  getRowId: row => row._rowKey ?? String(row.id) ?? String(Math.random()),
  onRowSelectionChange:  u => { rowSelection.value  = typeof u === 'function' ? u(rowSelection.value)  : u },
  onColumnFiltersChange: u => { columnFilters.value = typeof u === 'function' ? u(columnFilters.value) : u },
  onSortingChange:       u => { tanSorting.value    = typeof u === 'function' ? u(tanSorting.value)    : u },
  onExpandedChange:      u => { expanded.value      = typeof u === 'function' ? u(expanded.value)      : u },
  onColumnSizingChange:  u => { columnSizing.value  = typeof u === 'function' ? u(columnSizing.value)  : u },
  getCoreRowModel:     getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel:   getSortedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  columnResizeMode: 'onChange',
  enableRowSelection: true,
})

// ─── Filter popover composable ────────────────────────────────────────────
const {
  openFilterColId,
  filterPopoverPos,
  colServerFilters,
  colChecklistState,
  MATCH_MODES,
  MATCH_MODE_LABELS,
  OPERATOR_LABELS,
  openFilterPopover,
  closeFilterPopover,
  applyServerFilter,
  clearServerFilter,
  clearColFilter,
  addConstraint,
  removeConstraint,
  toggleChecklistValue,
  toggleChecklistAll,
  isFilterActive,
} = useTanFilterPopover({
  filtersGetter:       () => filters,
  loadLazyDataGetter:  () => loadLazyData,
  initFiltersGetter:   () => initFilters,
  tableInstanceGetter: () => tableInstance,
  first,
  lazyParams,
  lineItemsGetter:           () => lineItems.value,
  columnsGetter:             () => visibleColumns.value,
  selectSettingsGetter:      () => selectSettings.value,
  autocompleteSettingsGetter:() => autocompleteSettings.value,
  acFullMapsGetter:          () => acFullMaps.value,
  getACContentFn:            getACContent,
  getSelectContentFn:        getSelectContent,
  formatDateFn:              formatDate,
})

// ─── Cell selection (Excel-like) ──────────────────────────────────────────
const {
  cellSelectionMode, selectedCells, isFillDragging, fillRange, fillHandleCell,
  cellCount, sum, average,
  toggleCellSelectionMode, onCellMouseDown: onSelMouseDown, onCellMouseEnter: onSelMouseEnter,
  onFillHandleMouseDown, onFillIncMouseDown, isCellSelected, isCellInFillRange, copyToClipboard,
} = useTanCellSelection({
  columnsGetter:       () => visibleColumns.value,
  lineItemsGetter:     () => lineItems.value,
  tableInstanceGetter: () => tableInstance,
  customFieldsGetter:  () => customFields.value,
  saveCellUpdateFn:    (...args) => saveCellUpdate?.(...args),
  notify,
  isEmptyRowFn:        isEmptyRow,
  isEditableEmptyRowFn:isEditableEmptyRow,
  hideIdGetter:        () => hideId.value,
  rootElGetter:        () => rootElRef.value,
})

// Пересчёт высоты при появлении/скрытии статусбара выделения
watch(cellSelectionMode, () => { if (autoFitHeight.value) nextTick(calculateTableHeight) })

// Helper: get lineItems index from TanStack row
const getRowLineIndex = (row) => {
  const items = lineItems.value
  const id = row.original.id ?? row.original._rowKey
  return items.findIndex(r => (r.id ?? r._rowKey) === id)
}

// Helper: get visible column index from column id
const getColVisibleIndex = (colId) => visibleColumns.value.findIndex(c => c.field === colId)

// ─── Cell editing ─────────────────────────────────────────────────────────
const INLINE_TYPES = new Set(['text', 'view', 'number', 'decimal', 'boolean', 'date', 'select', 'autocomplete', 'textarea'])

let _activeInlineVal = null
const activeInline = customRef((track, trigger) => ({
  get() { track(); return _activeInlineVal },
  set(v) { _activeInlineVal = v; trigger() },
}))  // { cellId, col, data }
const activeFull     = ref(null)  // { cellId, col, data }
const fileEditOpen   = ref(false)
const imagePreviewOpen = ref(false)
const imagePreviewSrc  = ref('')
const imagePreviewName = ref('')

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','bmp','svg'])

const getFileExt = (path) => {
  if (!path) return ''
  const q = path.indexOf('?')
  const clean = q >= 0 ? path.slice(0, q) : path
  const dot = clean.lastIndexOf('.')
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : ''
}

const resolveFileUrl = async (value, mediaSource) => {
  if (!value) return value
  // Если путь уже абсолютный (http/https или начинается с /assets и т.п.) — берём как есть.
  if (/^(https?:)?\/\//i.test(value)) return value
  // Разбираем на dir/name. value может быть вида "/claude1.png" или "subdir/claude1.png".
  const clean = value.replace(/^\/+/, '')
  const lastSlash = clean.lastIndexOf('/')
  const dir = lastSlash >= 0 ? '/' + clean.slice(0, lastSlash) + '/' : '/'
  const name = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean
  try {
    const src = mediaSource || 1
    const resp = await fetch(`/api/files?path=${encodeURIComponent(dir)}&source=${src}`, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    const json = await resp.json()
    const files = json?.data?.files || []
    const hit = files.find(f => f.name === name)
    if (hit?.url) return hit.url
  } catch (e) {
    console.error('resolveFileUrl', e)
  }
  return value
}

const onFilePreview = async (path, mediaSource) => {
  if (!path) return
  const resolved = await resolveFileUrl(path, mediaSource)
  const ext = getFileExt(path)
  if (IMAGE_EXTS.has(ext)) {
    imagePreviewSrc.value = resolved
    imagePreviewName.value = (path.split('/').pop() || path)
    imagePreviewOpen.value = true
  } else {
    window.open(resolved, '_blank', 'noopener')
  }
}

// Прямое открытие файл-браузера из ячейки (один клик).
const browserOpen       = ref(false)
const browserMediaSource = ref(1)
const browserInitialPath = ref('')
const browserTarget     = ref(null)  // { col, data }

const openFileBrowserForCell = (col, data) => {
  browserMediaSource.value = col.mediaSource || 1
  browserInitialPath.value = data?.[col.field] ?? ''
  browserTarget.value = { col, data }
  browserOpen.value = true
}

const onBrowserFileSelected = (filePath) => {
  const tgt = browserTarget.value
  browserOpen.value = false
  if (!tgt) return
  saveCellUpdate(tgt.data, tgt.col.field, filePath)
  browserTarget.value = null
}
const fullEditValue  = ref(null)
const fullPopoverRef = ref(null)

// data — необязателен; если передан, customFields[data.id]?.[col.field] может переопределить readonly/type
const getCellCol = (col, data) => {
  if (!data?.id) return col
  const cf = customFields.value[data.id]?.[col.field]
  if (!cf) return col
  return { ...col, ...cf, readonly: cf.readonly == 1 || cf.readonly === true }
}
const isCellEditable = (col, data) => {
  const c = getCellCol(col, data)
  return c && c.field !== 'id' && !c.readonly && c.type !== 'html' && c.type !== 'hidden'
}
const isInlineType = (col, data) => {
  const c = getCellCol(col, data)
  return !c?.type || INLINE_TYPES.has(c.type)
}

const closeInline = () => { activeInline.value = null }
const closeFull   = () => { fullPopoverRef.value?.hide(); activeFull.value = null; fullEditValue.value = null }

const activateInlineCell = (cell) => {
  const col  = cell.column.columnDef.meta
  const data = cell.row.original
  if (!isCellEditable(col, data)) return
  if (!isInlineType(col, data)) { activateFullCell(cell); return }
  activeFull.value = null
  activeInline.value = { cellId: cell.id, col: getCellCol(col, data), data }
}

let fullPopoverRepositioning = false

const activateFullCell = (cell, triggerEl) => {
  const col  = cell.column.columnDef.meta
  const data = cell.row.original
  if (!isCellEditable(col, data)) return
  activeInline.value = null
  fullEditValue.value = cell.row.original[col.field] ?? ''
  activeFull.value = { cellId: cell.id, col, data: cell.row.original }
  if (!triggerEl) return
  const pop = fullPopoverRef.value
  if (!pop) return
  if (pop.visible) {
    fullPopoverRepositioning = true
    pop.hide()
    nextTick(() => { pop.show({ currentTarget: triggerEl }, triggerEl) })
  } else {
    nextTick(() => pop.show({ currentTarget: triggerEl }, triggerEl))
  }
}

const onCellClick = (cell, event) => {
  if (cellSelectionMode.value) return  // In selection mode, clicks are handled by onSelMouseDown
  const col  = cell.column.columnDef.meta
  const data = cell.row.original
  if (!col || !isCellEditable(col, data)) return
  if (isEmptyRow(data.id) && !isEditableEmptyRow(data._rowKey)) return
  if (activeInline.value?.cellId === cell.id) return
  // Булев чекбокс — переключаем значение сразу, без режима редактирования.
  if (col.type === 'boolean') {
    const current = getFieldValue(data, cell.column.id)
    const next = (current == 1 || current === true) ? 0 : 1
    saveCellUpdate(data, cell.column.id, next)
    return
  }
  // Тип 'file' рендерится кастомно: клик по имени → превью/открытие в новой
  // вкладке, кнопка-папка рядом открывает файл-браузер. Сам клик по ячейке
  // ничего не запускает.
  if (col.type === 'file') return
  if (isInlineType(col, data)) activateInlineCell(cell)
  else activateFullCell(cell, event.currentTarget)
}

const onCellDblClick = (cell, event) => {
  const col  = cell.column.columnDef.meta
  const data = cell.row.original
  if (!col || !isCellEditable(col, data)) return
  if (isEmptyRow(data.id) && !isEditableEmptyRow(data._rowKey)) return
  activateFullCell(cell, event.currentTarget)
}

const onInlineNavigate = (currentCell, dir) => {
  const editableCols = visibleColumns.value.filter(c => isCellEditable(c) && isInlineType(c))
  // Нередактируемые пустые строки пропускаем при навигации
  const allRows = tableInstance.getRowModel().rows.filter(r =>
    !isEmptyRow(r.original.id) || isEditableEmptyRow(r.original._rowKey)
  )
  let colIdx = editableCols.findIndex(c => c.field === currentCell.column.id)
  let rowIdx = allRows.findIndex(r => r.id === currentCell.row.id)

  if (colIdx < 0) colIdx = 0
  if (rowIdx < 0) rowIdx = 0

  const maxSteps = (editableCols.length * allRows.length) + 1
  for (let step = 0; step < maxSteps; step++) {
    const prevRow = rowIdx
    if (dir === 'next-col') {
      if (colIdx < editableCols.length - 1) colIdx++
      else { colIdx = 0; rowIdx = Math.min(rowIdx + 1, allRows.length - 1) }
    } else if (dir === 'prev-col') {
      if (colIdx > 0) colIdx--
      else { colIdx = editableCols.length - 1; rowIdx = Math.max(rowIdx - 1, 0) }
    } else if (dir === 'next-row') {
      rowIdx = Math.min(rowIdx + 1, allRows.length - 1)
    } else if (dir === 'prev-row') {
      rowIdx = Math.max(rowIdx - 1, 0)
    }

    // Граница для навигации по строкам — дальше идти некуда
    if ((dir === 'next-row' || dir === 'prev-row') && rowIdx === prevRow) break

    const col = editableCols[colIdx]
    const row = allRows[rowIdx]
    if (!col || !row) break

    // Пропускаем ячейки, readonly или non-inline по customFields данной строки
    if (isCellEditable(col, row.original) && isInlineType(col, row.original)) {
      const cell = row.getVisibleCells().find(c => c.column.id === col.field)
      if (cell) nextTick(() => activateInlineCell(cell))
      return
    }
  }
}

const onFullEditSave = () => {
  if (activeFull.value) saveCellUpdate(activeFull.value.data, activeFull.value.col.field, fullEditValue.value)
  closeFull()
}

// ─── Flat items for virtual scroll (data rows + expansion rows) ───────────
const flatItems = computed(() => {
  const items = []
  for (const row of tableInstance.getRowModel().rows) {
    items.push({ type: 'row', row, key: row.id })
    if (row.getIsExpanded()) {
      items.push({ type: 'expansion', row, key: `${row.id}__exp` })
    }
  }
  return items
})

// ─── TanStack Virtual ─────────────────────────────────────────────────────
const virtualizer = useVirtualizer({
  get count() { return flatItems.value.length },
  getScrollElement: () => scrollRef.value,
  estimateSize: i => flatItems.value[i]?.type === 'expansion' ? 250 : 34,
  measureElement: el => el?.getBoundingClientRect().height ?? 34,
  overscan: 8,
  getItemKey: i => flatItems.value[i]?.key ?? String(i),
})

// При смене данных (сортировка, фильтр, страница) — сбросить кеш высот
// и вернуться в начало. consumeSkip() > 0 — подавить сброс скрола при
// обновлении ячейки (saveCellUpdate из useTanCRUD).
watch(lineItems, () => {
  const suppress = consumeSkip?.()
  nextTick(() => {
    if (!suppress && !_scrollToLastPending) {
      if (scrollRef.value) scrollRef.value.scrollTop = 0
    } else if (activeInline.value) {
      // После обновления lineItems cell.id может измениться (пустая строка → реальная запись).
      // Переактивируем ячейку: для пустых строк ищем по _rowKey (id сменился 'empty' → реальный),
      // для обычных — по id.
      const dataId   = activeInline.value.data?.id
      const rowKey   = activeInline.value.data?._rowKey
      const colField = activeInline.value.col?.field
      if (dataId != null && colField) {
        let newRow
        if (isEmptyRow(dataId) && rowKey) {
          // id изменился с 'empty' → реальный после insert: ищем по стабильному _rowKey
          newRow = tableInstance.getRowModel().rows.find(r => r.original._rowKey === rowKey)
        } else {
          newRow = tableInstance.getRowModel().rows.find(r => r.original.id == dataId)
        }
        const newCell = newRow?.getVisibleCells().find(c => c.column.id === colField)
        if (newCell) {
          activeInline.value = { cellId: newCell.id, col: activeInline.value.col, data: newRow.original }
          nextTick(() => document.querySelector('.tan-edit-div, .tan-edit-checkbox')?.focus())
        } else {
          closeInline()
        }
      }
    }
  })
})

// ─── Paginator ────────────────────────────────────────────────────────────
const currentPageSize = ref(10)
const currentPage  = computed(() => currentPageSize.value > 0 ? Math.floor(first.value / currentPageSize.value) + 1 : 1)
const totalPages   = computed(() => currentPageSize.value > 0 ? Math.ceil(totalRecords.value / currentPageSize.value) : 1)

const emitPage = (f, rows) => { first.value = f; onPage?.({ first: f, rows }) }
const goFirst  = () => { if (first.value > 0) emitPage(0, currentPageSize.value) }
const goPrev   = () => { const n = Math.max(0, first.value - currentPageSize.value); if (n !== first.value) emitPage(n, currentPageSize.value) }
const goNext   = () => { const n = first.value + currentPageSize.value; if (n < totalRecords.value) emitPage(n, currentPageSize.value) }
const goLast   = () => { const n = (totalPages.value - 1) * currentPageSize.value; if (n !== first.value) emitPage(n, currentPageSize.value) }
const onRowsPerPageChange = e => { currentPageSize.value = Number(e.target.value); emitPage(0, currentPageSize.value) }

// ─── Settings popover ─────────────────────────────────────────────────────
const settingsRef = ref(null)
const toggleSettings = (e) => settingsRef.value?.toggle(e)

// ─── Initialization (mirrors PVTables.vue onMounted) ─────────────────────
onMounted(async () => {
  // Читаем реальный размер кнопки из CSS-переменной PrimeVue
  const cs = getComputedStyle(document.documentElement)
  const remVal = cs.getPropertyValue('--p-button-icon-only-width').trim()
  if (remVal) {
    const rootFontSize = parseFloat(cs.fontSize)
    actionBtnSize.value = Math.round(parseFloat(remVal) * rootFontSize)
  }

  loading.value = true
  lazyParams.value = { first: 0, rows: 10, sortField: null, sortOrder: null }
  try {
    const response = await api.options()
    if (!response.data.hasOwnProperty('fields')) {
      notify('error', { detail: 'Поля таблицы не получены' }, true)
      loading.value = false
      return
    }

    let fields = response.data.fields

    if (response.data.limit !== false) {
      rowsPerPage.value     = response.data.limit
      currentPageSize.value = response.data.limit
      lazyParams.value.rows = response.data.limit
    }

    // Selects
    if (response.data.selects) {
      for (let k in response.data.selects) {
        if (typeof response.data.selects[k] === 'object' && response.data.selects[k] !== null) {
          selectSettings.value[k] = response.data.selects[k]
        }
      }
    }
    if (response.data.data_fields)  dataFields.value = response.data.data_fields
    if (response.data.form)         form.value        = response.data.form
    if (response.data.hide_id == 1) hideId.value      = true
    if (response.data.actions_frozen)    actionsFrozen.value = response.data.actions_frozen
    if (response.data.row_class_trigger) row_class_trigger.value = response.data.row_class_trigger
    if (response.data.table_tree)        table_tree.value = response.data.table_tree
    if (response.data.row_drag)          rowDrag.value = true

    // Top filters
    if (response.data.filters) {
      topFilters0 = response.data.filters
      for (let f in topFilters0) {
        topFilters0[f].field = f
        if (topFilters0[f].default) topFilters0[f].default = String(topFilters0[f].default)
        if (!topFilters0[f].label) topFilters0[f].label = f
        topFilters0[f].rows = []
        if (!topFilters0[f].type) topFilters0[f].type = 'text'
      }
    }

    // Parse columns
    let filterFields = []
    let cols = []
    for (let field in fields) {
      fields[field].field = field
      if (!fields[field].label)  fields[field].label = field
      if (!fields[field].type)   fields[field].type  = field === 'id' ? 'view' : 'text'
      fields[field].readonly = fields[field].readonly === true || fields[field].readonly == 1
      if (!selectSettings.value[field]) selectSettings.value[field] = {}
      if (fields[field].select_data)    selectSettings.value[field].rows = fields[field].select_data
      switch (fields[field].type) {
        case 'view': case 'number': case 'decimal': case 'autocomplete':
          fields[field].dataType = 'numeric'; break
        case 'date':    fields[field].dataType = 'date'; break
        case 'boolean': fields[field].dataType = 'boolean'; break
        default:        fields[field].dataType = 'text'
      }
      cols.push(fields[field])
      filterFields.push(field)
    }
    globalFilterFields.value = filterFields
    columns.value = cols
    fieldsRef.value = fields

    // Инициализация ширин колонок (ls → server → auto-fit)
    if (response.data.fields_style) serverFieldsStyle.value = response.data.fields_style
    initColumnWidths()
    // Для дочерних таблиц — масштабировать сохранённые ширины под реальный контейнер.
    // Отступы фиксированы: .tan-expansion-td padding 16px*2=32 + .p-3 12px*2=24 = 56px
    if (props.child && !autoFitCols.value) {
      const savedWidths = { ...columnSizing.value }
      const totalSaved = Object.values(savedWidths).reduce((s, w) => s + w, 0)
      if (totalSaved > 0) {
        const containerWidth = totalSaved - 120
        const scale = containerWidth / totalSaved
        const fields = Object.keys(savedWidths)
        const newSizing = {}
        let distributed = 0
        fields.forEach((field, i) => {
          if (i === fields.length - 1) {
            newSizing[field] = Math.max(40, containerWidth - distributed)
          } else {
            const w = Math.max(40, Math.floor(savedWidths[field] * scale))
            newSizing[field] = w
            distributed += w
          }
        })
        columnSizing.value = newSizing
      }
    }

    // Filters composable
    let composableLoadLazyData = null
    const filtersComposable = usePVTableFilters(
      props, fields, topFilters0,
      (...args) => composableLoadLazyData?.(...args),
      ref(null),
      lazyParams
    )
    filters        = filtersComposable.filters
    topFilters     = filtersComposable.topFilters
    initFilters    = filtersComposable.initFilters
    onSetTopFilter = filtersComposable.onSetTopFilter
    prepFilters    = filtersComposable.prepFilters
    clearFilter    = filtersComposable.clearFilter

    // Load data functions
    loadLazyData           = createLoadLazyData(api, fields, filters, () => prepFilters(), notify, () => props.sorting)
    composableLoadLazyData = loadLazyData
    onPage                 = createOnPage(loadLazyData)
    initFilters()

    // Actions composable
    actionsComposable = usePVTableActions({
      api, props,
      prepFilters: () => prepFilters(),
      refresh, notify, emit, dataFields, selectedlineItems, table_tree,
      filters: () => filters,
      modalFormDialog, modalFormData, modalFormAction, modalFormRowData, modalFormType, modalFormColumns,
    })
    hideModalForm   = actionsComposable.hideModalForm
    submitModalForm = actionsComposable.submitModalForm

    // CRUD composable
    const crudComposable = useTanCRUD(
      api, () => prepFilters(), notify, refresh, emit, props,
      lineItems, findIndexById, customFields, row_setting, table_tree,
      ref({}),
      childComponentRefs,
      { updateEmptyRow, isEmptyRow, isEditableEmptyRow, emptyRowsState },
      selectedlineItems, fieldsRef, activeInline,
      cacheAction,
    )
    initUndoRedo(api, lineItems, findIndexById, crudComposable.skipScroll, refresh)
    lineItem                = crudComposable.lineItem
    lineItemDialog          = crudComposable.lineItemDialog
    deleteLineItemDialog    = crudComposable.deleteLineItemDialog
    deleteLineItemsDialog   = crudComposable.deleteLineItemsDialog
    mywatch                 = crudComposable.mywatch
    openNew                 = crudComposable.openNew
    editLineItem            = crudComposable.editLineItem
    hideDialog              = crudComposable.hideDialog
    saveLineItem            = crudComposable.saveLineItem
    confirmDeleteLineItem   = crudComposable.confirmDeleteLineItem
    deleteLineItem          = crudComposable.deleteLineItem
    confirmDeleteSelected   = crudComposable.confirmDeleteSelected
    deleteSelectedLineItems = crudComposable.deleteSelectedLineItems
    saveCellUpdate          = crudComposable.saveCellUpdate
    consumeSkip             = crudComposable.consumeSkip

    // Expand composable
    const expandComposable = usePVTableExpand(table_tree, () => filters, dataFields, props.table)
    subsComposable                 = expandComposable.subs
    subfiltersComposable           = expandComposable.subfilters
    parentRowComposable            = expandComposable.parent_row
    expandedTableTreeRowsComposable = expandComposable.expandedTableTreeRows

    // Обёртки синхронизируют внутренний expandedRows composable с TanStack expanded
    const _toogleExpand = expandComposable.toogleExpandRow
    toogleExpandRowComposable = async (data) => {
      await _toogleExpand(data)
      expanded.value = { ...expandComposable.expandedRows.value }
    }
    const _setExpand = expandComposable.setExpandedRow
    setExpandedRowComposable = async (event, tmpt) => {
      await _setExpand(event, tmpt)
      expanded.value = { ...expandComposable.expandedRows.value }
    }

    // Process actions from server + props
    const processed = actionsComposable.processActions(
      response.data.actions, props.actions,
      {
        editLineItem, confirmDeleteLineItem, confirmDeleteSelected,
        openNew, setExpandedRow: setExpandedRowComposable,
        Insert: crudComposable.Insert,
        Insert_child: crudComposable.Insert_child,
      }
    )
    cur_actions.value      = processed.cur_actions
    nemu_actions.value     = processed.nemu_actions
    actions_row.value      = processed.actions_row
    SpeedDialEnabled.value = processed.SpeedDialEnabled
    actions1.value         = response.data.actions


    await loadLazyData()

    // fitColumnsToContainer после загрузки данных — чтобы измерить реальное содержимое
    nextTick(() => { if (autoFitCols.value) fitColumnsToContainer() })

    // autoFitHeight — рассчитать высоту после загрузки данных
    if (autoFitHeight.value) {
      calculateTableHeight()
      window.addEventListener('resize', calculateTableHeight)
    }
  } catch (err) {
    console.error('TanTable init error', err)
    notify('error', { detail: err.message }, true)
    loading.value = false
  }
})

// ─── Clear filters ────────────────────────────────────────────────────────
const onClearFilter = () => {
  columnFilters.value   = []
  colServerFilters.value = {}
  colChecklistState.value = {}
  tanSorting.value      = []
  clearFilter?.()
}

// ─── Clear single column filter (from paginator chip) ────────────────────
const onClearColFilterChip = (columnId) => {
  clearColFilter(columnId)
}

// ─── Filter popover helpers ───────────────────────────────────────────────
const openFilterColMeta = computed(() => {
  if (!openFilterColId.value) return null
  return visibleColumns.value.find(c => c.field === openFilterColId.value) ?? null
})
const openFilterColType = computed(() => openFilterColMeta.value?.type ?? 'text')
const openFilterMatchModes = computed(() => MATCH_MODES[openFilterColType.value] || MATCH_MODES.text)
const openFilterServerState = computed(() =>
  openFilterColId.value ? colServerFilters.value[openFilterColId.value] : null
)
const openFilterChecklistState = computed(() =>
  openFilterColId.value ? colChecklistState.value[openFilterColId.value] : null
)
const openFilterSelectOptions = computed(() => {
  if (!openFilterColId.value) return []
  const field = openFilterColId.value
  const rows = selectSettings.value?.[field]?.rows
    ?? openFilterColMeta.value?.select_data
    ?? openFilterColMeta.value?.rows
  return rows ?? []
})

// ─── Row drag ─────────────────────────────────────────────────────────────
const {
  draggingRowKey, dragOverRowKey,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
} = useTanRowDrag({
  lineItems,
  onReorder: async (newOrder) => {
    await api.action('sortable_reorder', { order: newOrder })
  },
})

// ─── Public API ───────────────────────────────────────────────────────────
let _scrollToLastPending = false

function scrollToLast() {
  // Ищем последнюю реальную (не empty) строку
  let idx = flatItems.value.length - 1
  while (idx >= 0 && flatItems.value[idx]?.type === 'row' && isEmptyRow(flatItems.value[idx].row.original.id)) {
    idx--
  }
  if (idx >= 0) virtualizer.value.scrollToIndex(idx, { align: 'center' })
}

function refreshAndScrollToLast() {
  _scrollToLastPending = true
  watch(lineItems, () => {
    requestAnimationFrame(() => {
      _scrollToLastPending = false
      scrollToLast()
    })
  }, { once: true })
  refresh()
}

defineExpose({ refresh, recalculateHeight: calculateTableHeight, scrollToLast, refreshAndScrollToLast })
</script>

<template>
  <div ref="rootElRef" class="card pvtables tan-root">

    <!-- ── Toolbar ── -->
    <TanToolbar
      :headActions="headActions"
      :topFilters="topFilters"
      :cellSelectionMode="cellSelectionMode"
      :showMobileSwitch="showMobileSwitch"
      :canUndo="canUndo"
      :canRedo="canRedo"
      :actions1="actions1"
      :table="props.table"
      :filters="filters"
      :api="api"
      @head-action="(action, e) => action.head_click(e, props.table, filters, selectedlineItems)"
      @set-top-filter="(filter) => onSetTopFilter?.(filter)"
      @clear="onClearFilter"
      @refresh="refresh(false)"
      @settings="toggleSettings"
      @switch-engine="emit('switch-engine')"
      @toggle-cell-selection="toggleCellSelectionMode"
      @switch-mobile="setForceDesktop(false)"
      @undo="undo"
      @redo="redo"
      @print-success="notify('success', { detail: 'Печать выполнена успешно' })"
      @print-error="(err) => notify('error', { detail: `Ошибка печати: ${err.message}` })"
    />

    <!-- ── Loading overlay ── -->
    <div v-if="loading" class="tan-loading">
      <i class="pi pi-spin pi-spinner" style="font-size:2rem" />
    </div>

    <!-- ── Scroll container ── -->
    <div ref="scrollRef" class="tan-scroll" :class="{ 'tan-cell-select-mode': cellSelectionMode }" :style="autoFitHeight ? { height: localScrollHeight } : { maxHeight: localScrollHeight }">
      <table class="tan-table" :style="{ width: tableInstance.getTotalSize() + 'px' }">

        <!-- HEAD -->
        <thead class="tan-thead">
          <tr v-for="hg in tableInstance.getHeaderGroups()" :key="hg.id">
            <th
              v-for="header in hg.headers" :key="header.id"
              :style="{ width: header.getSize() + 'px' }"
              class="tan-th"
              :class="{
                'tan-frozen-right': actionsFrozen === 'right' && header.id === '__actions__',
                'tan-frozen-left':  actionsFrozen === 'left'  && header.id === '__actions__',
              }"
            >
              <div class="tan-th-label">
                <div class="tan-th-text"
                  :class="{ 'tan-sortable': header.column.getCanSort() }"
                  @click="header.column.getToggleSortingHandler()?.($event)"
                >
                  <FlexRender v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header" :props="header.getContext()" />
                  <i v-if="header.column.getIsSorted() === 'asc'"  class="pi pi-sort-amount-up-alt tan-sort-icon" />
                  <i v-else-if="header.column.getIsSorted() === 'desc'" class="pi pi-sort-amount-down tan-sort-icon" />
                </div>
              </div>
              <button
                v-if="header.column.getCanFilter()"
                class="tan-filter-btn"
                :class="{
                  'tan-filter-btn--active': isFilterActive(header.column.id),
                  'tan-filter-btn--open': openFilterColId === header.column.id,
                }"
                @click.stop="openFilterPopover($event, header.column.id)"
                title="Фильтр"
              >
                <i class="pi pi-filter" />
              </button>
              <div
                v-if="header.column.getCanResize()"
                class="tan-resize-handle"
                :class="{ 'tan-resizing': header.column.getIsResizing() }"
                @mousedown.stop="onResizeMouseDown($event, header)"
                @touchstart.stop="header.getResizeHandler()($event)"
              />
            </th>
          </tr>
        </thead>

        <!-- BODY (virtual) -->
        <tbody class="tan-tbody" :style="{ height: virtualizer.getTotalSize() + 'px' }">
          <template v-for="vItem in virtualizer.getVirtualItems()" :key="vItem.key">

            <!-- Data row -->
            <tr
              v-if="flatItems[vItem.index]?.type === 'row'"
              :ref="el => { if (el) virtualizer.measureElement(el) }"
              :data-index="vItem.index"
              :style="[{ position:'absolute', top:0, left:0, width:'100%', transform:`translateY(${vItem.start}px)` }, rowStyle(flatItems[vItem.index]?.row.original)]"
              class="tan-row"
              :class="[
                { 'tan-row-selected': flatItems[vItem.index]?.row.getIsSelected() },
                rowClass(flatItems[vItem.index]?.row.original),
                isEmptyRow(flatItems[vItem.index]?.row.original?.id)
                  ? (isEditableEmptyRow(flatItems[vItem.index]?.row.original?._rowKey) ? 'tan-row-empty' : 'tan-row-empty-locked')
                  : '',
                { 'tan-row-dragging':  rowDrag && draggingRowKey === flatItems[vItem.index]?.row.original?._rowKey },
                { 'tan-row-drag-over': rowDrag && dragOverRowKey === flatItems[vItem.index]?.row.original?._rowKey },
              ]"
              :draggable="rowDrag && !isEmptyRow(flatItems[vItem.index]?.row.original?.id) ? 'true' : 'false'"
              @dragstart="rowDrag && onDragStart($event, flatItems[vItem.index]?.row.original?._rowKey)"
              @dragover="rowDrag && onDragOver($event, flatItems[vItem.index]?.row.original?._rowKey)"
              @dragleave="rowDrag && onDragLeave()"
              @drop="rowDrag && onDrop($event, flatItems[vItem.index]?.row.original?._rowKey)"
              @dragend="rowDrag && onDragEnd()"
            >
              <td
                v-for="cell in flatItems[vItem.index]?.row.getVisibleCells()"
                :key="cell.id"
                :style="[{ width: cell.column.getSize() + 'px' }, cellStyle(flatItems[vItem.index]?.row.original, cell.column.id)]"
                class="tan-td"
                :class="[
                  cellClass(flatItems[vItem.index]?.row.original, cell.column.id),
                  {
                    'tan-td-editing': activeInline?.cellId === cell.id,
                    'tan-td-selected': cellSelectionMode && isCellSelected(getRowLineIndex(cell.row), getColVisibleIndex(cell.column.id)),
                    'tan-td-fill-range': cellSelectionMode && isCellInFillRange(getRowLineIndex(cell.row), getColVisibleIndex(cell.column.id)),
                    'tan-frozen-right': actionsFrozen === 'right' && cell.column.id === '__actions__',
                    'tan-frozen-left':  actionsFrozen === 'left'  && cell.column.id === '__actions__',
                  }
                ]"
                @click="cell.column.columnDef.meta && onCellClick(cell, $event)"
                @dblclick="cell.column.columnDef.meta && onCellDblClick(cell, $event)"
                @mousedown="cellSelectionMode && cell.column.columnDef.meta && onSelMouseDown(getRowLineIndex(cell.row), getColVisibleIndex(cell.column.id), $event)"
                @mouseenter="cellSelectionMode && cell.column.columnDef.meta && onSelMouseEnter(getRowLineIndex(cell.row), getColVisibleIndex(cell.column.id))"
              >
                <TanEditCell
                  v-if="activeInline?.cellId === cell.id"
                  :col="activeInline.col"
                  :initial-value="getFieldValue(cell.row.original, cell.column.id)"
                  :selectSettings="selectSettings"
                  :autocompleteSettings="autocompleteSettings"
                  @save="(v) => { closeInline(); saveCellUpdate(cell.row.original, cell.column.id, v) }"
                  @cancel="closeInline"
                  @navigate="(dir) => onInlineNavigate(cell, dir)"
                />
                <FlexRender v-else :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                <!-- Fill handles: copy + increment -->
                <div
                  v-if="fillHandleCell && fillHandleCell.rowIndex === getRowLineIndex(cell.row) && fillHandleCell.colIndex === getColVisibleIndex(cell.column.id)"
                  class="tan-fill-handles"
                >
                  <div class="tan-fill-handle" title="Копировать значение" @mousedown="onFillHandleMouseDown" />
                  <div class="tan-fill-inc" title="Инкремент (+1)" @mousedown="onFillIncMouseDown">+</div>
                </div>
              </td>
            </tr>

            <!-- Expansion row -->
            <tr
              v-else-if="flatItems[vItem.index]?.type === 'expansion'"
              :ref="el => { if (el) virtualizer.measureElement(el) }"
              :data-index="vItem.index"
              :style="{ position:'absolute', top:0, left:0, width: tableInstance.getTotalSize() + 'px', transform:`translateY(${vItem.start}px)` }"
              class="tan-expansion-row"
            >
              <td :colspan="tableInstance.getAllLeafColumns().length" class="tan-expansion-td">
                <template v-if="subsComposable?.[flatItems[vItem.index]?.row.original._rowKey]">
                  <div v-if="subsComposable[flatItems[vItem.index].row.original._rowKey].action === 'subtables'" class="p-3">
                    <PVTables
                      :table="subsComposable[flatItems[vItem.index].row.original._rowKey].table"
                      :actions="actions"
                      :filters="subfiltersComposable?.[flatItems[vItem.index].row.original._rowKey]"
                      @refresh-table="refresh(false)"
                      :child="true"
                      :ref="el => { if (el) childComponentRefs[flatItems[vItem.index].row.original._rowKey] = el }"
                      @get-response="emit('get-response', $event)"
                    />
                  </div>
                  <div v-else-if="subsComposable[flatItems[vItem.index].row.original._rowKey].action === 'subtabs'" class="p-3">
                    <PVTabs
                      :tabs="subsComposable[flatItems[vItem.index].row.original._rowKey].tabs"
                      :actions="actions"
                      :parent_row="parentRowComposable?.value ?? {}"
                      :filters="subfiltersComposable?.[flatItems[vItem.index].row.original._rowKey]"
                      @refresh-table="refresh(false)"
                      :child="true"
                      :ref="el => { if (el) childComponentRefs[flatItems[vItem.index].row.original._rowKey] = el }"
                      @get-response="emit('get-response', $event)"
                    />
                  </div>
                </template>
                <slot v-else
                  name="expansion"
                  :data="flatItems[vItem.index]?.row.original"
                  :row="flatItems[vItem.index]?.row"
                >
                  <pre class="tan-expansion-fallback">{{ JSON.stringify(flatItems[vItem.index]?.row.original, null, 2) }}</pre>
                </slot>
              </td>
            </tr>

          </template>
        </tbody>
      </table>
    </div>

    <!-- ── Paginator ── -->
    <TanPaginator
      :first="first"
      :currentPageSize="currentPageSize"
      :totalRecords="totalRecords"
      :currentPage="currentPage"
      :totalPages="totalPages"
      :columnFilters="columnFilters"
      :rowSelection="rowSelection"
      @go-first="goFirst"
      @go-prev="goPrev"
      @go-next="goNext"
      @go-last="goLast"
      @rows-per-page-change="onRowsPerPageChange"
      @clear-col-filter="onClearColFilterChip"
    />

    <!-- ── Cell Selection Status Bar ── -->
    <div v-if="cellSelectionMode" class="tan-status-bar">
      <div class="tan-status-info">
        <span class="tan-status-item">
          <i class="pi pi-check-square" />
          Выделено: <strong>{{ cellCount }}</strong>
        </span>
        <span v-if="average !== null" class="tan-status-item">
          <i class="pi pi-chart-line" />
          Среднее: <strong>{{ formatNumber(average) }}</strong>
        </span>
        <span v-if="sum !== null" class="tan-status-item">
          <i class="pi pi-calculator" />
          Сумма: <strong>{{ formatNumber(sum) }}</strong>
        </span>
      </div>
      <div class="tan-status-actions">
        <button class="tan-status-btn" @click="copyToClipboard" :disabled="cellCount === 0" title="Копировать (Ctrl+C)">
          <i class="pi pi-copy" /> Копировать
        </button>
        <button class="tan-status-btn tan-status-btn--close" @click="toggleCellSelectionMode" title="Выйти из режима выделения">
          <i class="pi pi-times" />
        </button>
      </div>
    </div>

    <!-- ── CRUD Dialogs ── -->
    <Dialog v-if="lineItemDialog" v-model:visible="lineItemDialog" header="Редактировать" modal>
      <PVForm
        v-model="lineItem" :columns="columns"
        :autocompleteSettings="autocompleteSettings" :selectSettings="selectSettings"
        :customFields="customFields[lineItem._rowKey]" :mywatch="mywatch" :form="form"
      />
      <template #footer>
        <Button label="Отмена" icon="pi pi-times" class="p-button-text" @click="hideDialog" />
        <Button label="Сохранить" icon="pi pi-check" class="p-button-text" @click="saveLineItem" />
      </template>
    </Dialog>

    <Dialog v-if="deleteLineItemDialog" v-model:visible="deleteLineItemDialog" header="Confirm" modal>
      <div class="confirmation-content">
        <i class="pi pi-exclamation-triangle p-mr-3" style="font-size:2rem" />
        <span v-if="lineItem">Вы хотите удалить эту запись?</span>
      </div>
      <template #footer>
        <Button label="Нет"  icon="pi pi-times" class="p-button-text" @click="deleteLineItemDialog = false" />
        <Button label="Да"   icon="pi pi-check" class="p-button-text" @click="deleteLineItem" />
      </template>
    </Dialog>

    <Dialog v-if="deleteLineItemsDialog" v-model:visible="deleteLineItemsDialog" header="Confirm" modal>
      <div class="confirmation-content">
        <i class="pi pi-exclamation-triangle p-mr-3" style="font-size:2rem" />
        <span>Вы хотите удалить отмеченные записи?</span>
      </div>
      <template #footer>
        <Button label="Нет" icon="pi pi-times" class="p-button-text" @click="deleteLineItemsDialog = false" />
        <Button label="Да"  icon="pi pi-check" class="p-button-text" @click="deleteSelectedLineItems" />
      </template>
    </Dialog>

    <Dialog v-if="modalFormDialog" v-model:visible="modalFormDialog"
      :header="modalFormAction?.action || 'Действие'" modal>
      <PVForm v-model="modalFormData" :columns="modalFormColumns"
        :autocompleteSettings="autocompleteSettings" :selectSettings="selectSettings" />
      <template #footer>
        <Button label="Отмена" icon="pi pi-times" class="p-button-text" @click="hideModalForm" />
        <Button
          :label="modalFormAction?.modal_form?.buttons?.submit?.label || 'Выполнить'"
          :icon="modalFormAction?.modal_form?.buttons?.submit?.icon || 'pi pi-check'"
          class="p-button-text" @click="submitModalForm"
        />
      </template>
    </Dialog>

    <Toast />
  </div>

  <!-- ── Filter popover ── -->
  <TanFilterPopoverUI
    :openFilterColId="openFilterColId"
    :filterPopoverPos="filterPopoverPos"
    :colType="openFilterColType"
    :colMeta="openFilterColMeta"
    :columnLabel="openFilterColId ? (tableInstance.getColumn(openFilterColId)?.columnDef.header ?? openFilterColId) : ''"
    :serverFilter="openFilterServerState"
    :selectOptions="openFilterSelectOptions"
    :matchModes="openFilterMatchModes"
    :matchModeLabels="MATCH_MODE_LABELS"
    :operatorLabels="OPERATOR_LABELS"
    :checklistAll="openFilterChecklistState?.all ?? []"
    :checklistChecked="openFilterChecklistState?.checked ?? null"
    @apply-server="applyServerFilter(openFilterColId)"
    @clear-all="clearColFilter(openFilterColId)"
    @close="closeFilterPopover()"
    @update:operator="v => { if (colServerFilters[openFilterColId]) colServerFilters[openFilterColId].operator = v }"
    @update:constraint-value="({ idx, value }) => { if (colServerFilters[openFilterColId]?.constraints[idx]) colServerFilters[openFilterColId].constraints[idx].value = value }"
    @update:constraint-mode="({ idx, value }) => { if (colServerFilters[openFilterColId]?.constraints[idx]) colServerFilters[openFilterColId].constraints[idx].matchMode = value }"
    @add-constraint="addConstraint(openFilterColId, openFilterColType)"
    @remove-constraint="idx => removeConstraint(openFilterColId, idx)"
    @toggle-checklist="val => toggleChecklistValue(openFilterColId, val)"
    @toggle-checklist-all="toggleChecklistAll(openFilterColId)"
  />

  <!-- ── Прямой файл-браузер из ячейки (один клик) ── -->
  <Dialog
    v-model:visible="browserOpen"
    header="Выбор файла"
    :modal="true"
    :dismissableMask="false"
    :style="{ width: '92vw', height: '86vh' }"
  >
    <div style="height: 100%;">
      <FileBrowser
        v-if="browserOpen"
        :mediaSource="browserMediaSource"
        :initialPath="browserInitialPath"
        :selectionMode="true"
        @fileSelected="onBrowserFileSelected"
      />
    </div>
  </Dialog>

  <!-- ── Image preview (для type=file изображений) ── -->
  <Dialog
    v-model:visible="imagePreviewOpen"
    :header="imagePreviewName || 'Превью'"
    :modal="true"
    :dismissableMask="true"
    :style="{ maxWidth: '90vw', maxHeight: '90vh' }"
  >
    <div style="display:flex; align-items:center; justify-content:center;">
      <img
        v-if="imagePreviewSrc"
        :src="imagePreviewSrc"
        :alt="imagePreviewName"
        style="max-width:85vw; max-height:78vh; object-fit:contain;"
      />
    </div>
  </Dialog>

  <!-- ── File field editor: отдельный Dialog, не Popover ── -->
  <Dialog
    v-model:visible="fileEditOpen"
    :header="activeFull?.col?.label ?? 'Файл'"
    :modal="true"
    :dismissableMask="false"
    :style="{ width: '92vw', height: '84vh' }"
    @hide="() => { activeFull = null; fullEditValue = null }"
  >
    <div v-if="activeFull" style="min-width: 320px;">
      <EditField
        v-model="fullEditValue"
        :field="activeFull.col"
        :data="activeFull.data"
        :use_data="false"
        :autocompleteSettings="autocompleteSettings"
        :selectSettings="selectSettings"
        :customFields="customFields[activeFull.data._rowKey] ?? {}"
        :use_readonly="false"
      />
      <div class="tan-full-popup-actions" style="margin-top:1rem;">
        <button class="tan-action-btn" @click="() => { fileEditOpen = false }">Отмена</button>
        <button class="tan-action-btn p-button-success" @click="() => { onFullEditSave(); fileEditOpen = false }">Сохранить</button>
      </div>
    </div>
  </Dialog>

  <!-- ── EditField popup (double-click inline edit) ── -->
  <Popover ref="fullPopoverRef" @hide="if (!fullPopoverRepositioning) { activeFull = null; fullEditValue = null } else { fullPopoverRepositioning = false }">
    <div v-if="activeFull" style="min-width: 220px; max-width: 400px;">
      <EditField
        v-model="fullEditValue"
        :field="activeFull.col"
        :data="activeFull.data"
        :use_data="false"
        :autocompleteSettings="autocompleteSettings"
        :selectSettings="selectSettings"
        :customFields="customFields[activeFull.data._rowKey] ?? {}"
        :use_readonly="false"
      />
      <div class="tan-full-popup-actions">
        <button class="tan-action-btn" @click="closeFull">Отмена</button>
        <button class="tan-action-btn p-button-success" @click="onFullEditSave">Сохранить</button>
      </div>
    </div>
  </Popover>

  <!-- ── Settings popover ── -->
  <TanSettingsPopover
    ref="settingsRef"
    :scrollHeight="localScrollHeight"
    :autoFitCols="autoFitCols"
    :autoFitHeight="autoFitHeight"
    @update:scrollHeight="localScrollHeight = $event"
    @update:autoFitCols="autoFitCols = $event"
    @update:autoFitHeight="autoFitHeight = $event"
    @fit-columns="fitColumnsToContainer()"
    @save-local="saveWidthsToLocal(); notify('success', { detail: 'Ширина сохранена локально' })"
    @save-server="saveFieldsStyleToServer()"
    @reset-local="resetLocalWidths()"
    @reset-server="resetServerWidths()"
  />
</template>
