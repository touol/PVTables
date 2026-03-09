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

import { ref, computed, h, watch, nextTick, onMounted } from 'vue'
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

import PVForm              from './PVForm.vue'
import PVTabs              from './PVTabs.vue'
import PVTablesSplitButton from './PVTablesSplitButton.vue'

import { useNotifications }    from './useNotifications'
import apiCtor                 from './api'
import { usePVTableData }      from '../composables/usePVTableData'
import { usePVTableFilters }   from '../composables/usePVTableFilters'
import { usePVTableActions }   from '../composables/usePVTableActions'
import { usePVTableCRUD }      from '../composables/usePVTableCRUD'
import { usePVTableExpand }    from '../composables/usePVTableExpand'
import { useActionsCaching }   from '../composables/useActionsCaching'
import { useTanColSizing }     from '../composables/useTanColSizing'
import { useRowHighlight }    from '../composables/useRowHighlight'
import { useTanFilterPopover } from '../composables/useTanFilterPopover'

import TanToolbar         from './TanToolbar.vue'
import TanPaginator       from './TanPaginator.vue'
import TanFilterPopoverUI from './TanFilterPopoverUI.vue'
import TanSettingsPopover from './TanSettingsPopover.vue'

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
const { cacheAction } = useActionsCaching()

// ─── State (инициализируется в onMounted из api.options()) ────────────────
const columns     = ref([{ field: 'id', label: 'ID' }])
const hideId      = ref(false)
const table_tree  = ref(null)
const dataFields  = ref([])
const selectSettings     = ref({})
const row_class_trigger  = ref({})
const globalFilterFields = ref([])
const actionsFrozen = ref(null)
const form          = ref({})
const actions1      = ref({})

const visibleColumns = computed(() =>
  columns.value.filter(
    x => x.modal_only != true && x.type != 'hidden' && !(hideId.value && x.field == 'id')
  )
)

// ─── Data composable ──────────────────────────────────────────────────────
const {
  loading, totalRecords, first, lineItems, lazyParams,
  autocompleteSettings, dynamicSelects, row_setting, customFields,
  filterList, createLoadLazyData, createOnPage,
  findIndexById, emptyRowsState, updateEmptyRow, isEmptyRow, isEditableEmptyRow,
} = usePVTableData(props.emptyRowsCount)

const { rowClass, rowStyle } = useRowHighlight(row_setting, row_class_trigger)

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

// ─── CRUD (инициализируется в onMounted) ──────────────────────────────────
let lineItem, lineItemDialog, deleteLineItemDialog, deleteLineItemsDialog
let openNew, editLineItem, hideDialog, saveLineItem
let confirmDeleteLineItem, deleteLineItem, confirmDeleteSelected, deleteSelectedLineItems
let mywatch

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
watch(localScrollHeight, v => { try { localStorage.setItem(HEIGHT_KEY, v || '85vh') } catch {} })
watch(() => props.scrollHeight, v => {
  if (v && !localStorage.getItem(HEIGHT_KEY)) localScrollHeight.value = v
})

// ─── Scroll container ref ─────────────────────────────────────────────────
const scrollRef = ref(null)

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
})

// ─── TanStack column definitions ──────────────────────────────────────────
const stringIncludesFilter = (row, columnId, filterValue) => {
  const val = row.getValue(columnId)
  return String(val ?? '').toLowerCase().includes(String(filterValue).toLowerCase())
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
        ? null
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
        case 'autocomplete': {
          const lbl = getACContent(col.field, value)
          return col.hide_id ? lbl : `${value} ${lbl}`
        }
        case 'select':   return getSelectContent(col.field, value)
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
  getRowId: row => String(row._rowKey ?? row.id ?? Math.random()),
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
  colFilterValues,
  openFilterValue,
  openFilterPopover,
  closeFilterPopover,
  clearColFilter,
} = useTanFilterPopover({
  filtersGetter:       () => filters,
  loadLazyDataGetter:  () => loadLazyData,
  initFiltersGetter:   () => initFilters,
  tableInstanceGetter: () => tableInstance,
  first,
  lazyParams,
})

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
// и вернуться в начало, иначе virtualizer использует старые измерения
// и строки накладываются или рендерятся на неправильных позициях.
watch(lineItems, () => {
  nextTick(() => {
    if (scrollRef.value) scrollRef.value.scrollTop = 0
    virtualizer.measure()
  })
})

// ─── Paginator ────────────────────────────────────────────────────────────
const currentPageSize = ref(10)
const currentPage  = computed(() => currentPageSize.value > 0 ? Math.floor(first.value / currentPageSize.value) + 1 : 1)
const totalPages   = computed(() => currentPageSize.value > 0 ? Math.ceil(totalRecords.value / currentPageSize.value) : 1)

const emitPage = (f, rows) => { onPage?.({ first: f, rows }) }
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

    // Инициализация ширин колонок (ls → server → auto-fit)
    if (response.data.fields_style) serverFieldsStyle.value = response.data.fields_style
    initColumnWidths()

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
    const crudComposable = usePVTableCRUD(
      api, () => prepFilters(), notify, refresh, emit, props,
      lineItems, findIndexById, customFields, row_setting, table_tree,
      ref({}),
      childComponentRefs,
      { updateEmptyRow, isEmptyRow, isEditableEmptyRow, emptyRowsState },
      selectedlineItems, ref(null)
    )
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
  } catch (err) {
    console.error('TanTable init error', err)
    notify('error', { detail: err.message }, true)
    loading.value = false
  }
})

// ─── Clear filters ────────────────────────────────────────────────────────
const onClearFilter = () => {
  columnFilters.value   = []
  colFilterValues.value = {}
  tanSorting.value      = []
  clearFilter?.()
}

// ─── Clear single column filter (from paginator chip) ────────────────────
const onClearColFilterChip = (columnId) => {
  clearColFilter(columnId)
  tableInstance.getColumn(columnId)?.setFilterValue(undefined)
}

// ─── Public API ───────────────────────────────────────────────────────────
defineExpose({ refresh })
</script>

<template>
  <div class="card pvtables tan-root">

    <!-- ── Toolbar ── -->
    <TanToolbar
      :headActions="headActions"
      :topFilters="topFilters"
      @head-action="(action, e) => action.head_click(e, props.table, filters, selectedlineItems)"
      @set-top-filter="(filter) => onSetTopFilter?.(filter)"
      @clear="onClearFilter"
      @refresh="refresh(false)"
      @settings="toggleSettings"
      @switch-engine="emit('switch-engine')"
    />

    <!-- ── Loading overlay ── -->
    <div v-if="loading" class="tan-loading">
      <i class="pi pi-spin pi-spinner" style="font-size:2rem" />
    </div>

    <!-- ── Scroll container ── -->
    <div ref="scrollRef" class="tan-scroll" :style="{ maxHeight: localScrollHeight }">
      <table class="tan-table" :style="{ width: tableInstance.getTotalSize() + 'px' }">

        <!-- HEAD -->
        <thead class="tan-thead">
          <tr v-for="hg in tableInstance.getHeaderGroups()" :key="hg.id">
            <th
              v-for="header in hg.headers" :key="header.id"
              :style="{ width: header.getSize() + 'px' }"
              class="tan-th"
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
                  'tan-filter-btn--active': header.column.getFilterValue() != null,
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
              :class="[{ 'tan-row-selected': flatItems[vItem.index]?.row.getIsSelected() }, rowClass(flatItems[vItem.index]?.row.original)]"
            >
              <td
                v-for="cell in flatItems[vItem.index]?.row.getVisibleCells()"
                :key="cell.id"
                :style="{ width: cell.column.getSize() + 'px' }"
                class="tan-td"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
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
    :filterValue="openFilterValue"
    :columnLabel="openFilterColId ? (tableInstance.getColumn(openFilterColId)?.columnDef.header ?? openFilterColId) : ''"
    @update:filterValue="v => openFilterValue = v"
    @apply="closeFilterPopover(true)"
    @close="closeFilterPopover(false)"
    @clear="clearColFilter(openFilterColId)"
  />

  <!-- ── Settings popover ── -->
  <TanSettingsPopover
    ref="settingsRef"
    :scrollHeight="localScrollHeight"
    :autoFitCols="autoFitCols"
    @update:scrollHeight="localScrollHeight = $event"
    @update:autoFitCols="autoFitCols = $event"
    @fit-columns="fitColumnsToContainer()"
    @save-local="saveWidthsToLocal(); notify('success', { detail: 'Ширина сохранена локально' })"
    @save-server="saveFieldsStyleToServer()"
    @reset-local="resetLocalWidths()"
    @reset-server="resetServerWidths()"
  />
</template>
